/**
 * This module encapsulates the logic to scrape the watchlist, query TMDB, and process duplicates/unknowns.
 */

const fs = require('fs');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { slugify } = require('./utils');

const tmdbOptions = {
	method: 'GET',
	headers: {
		accept: 'application/json',
		Authorization: 'Bearer ' + process.env.TMDB_API_TOKEN
	}
};

const googleWatchlistUrl = process.env.GOOGLE_WATCHLIST_URL;
const overrideCache = process.env.OVERRIDE_CACHE;
const unknownsFile = './cache/unknowns.json';

// Scrape Google Watchlist
async function scrapeWatchlist() {
	let document = {};
	let items = [];
	let prevFirstItem = null;
	console.log('Scraping Google Watchlist...');

	for (let i = 0; i <= 5; i++) {
		try {
			const response = await axios.get(`${googleWatchlistUrl}?pageNumber=${i + 1}`, {
				headers: {
				'User-Agent': 'Mozilla/5.0'
				}
			});
			document = new JSDOM(response.data).window.document;
			const elements = document.querySelectorAll('[data-hveid] a[aria-label]');
			let pageItems = [];
			for (let el of elements) {
				const label = el.getAttribute('aria-label');
				if (label === prevFirstItem) break;
				pageItems.push(label);
			}
			if (pageItems.length && pageItems[0] !== prevFirstItem) {
				prevFirstItem = pageItems[0];
				items.push(...pageItems);
				console.log('Page ' + (i + 1) + ': ' + prevFirstItem);
			}
		} catch (error) {
			console.error(error);
		}
	}
	console.log(`Scraped ${items.length} items.`);
	return items;
}

// Query TMDB for a movie. If resultIndex is not 0, returns the alternate result.
async function fetchMovieData(movie, movieData = {}, resultIndex = 0) {
	const fallback = {
		id: 0,
		title: movie,
		googleTitle: movieData.googleTitle,
		releaseDate: null,
		releaseYear: null,
		mediaType: null,
		dateAdded: Date.now(),
		googleSearchUrl: 'https://google.ca/search?q=' + encodeURIComponent(movie)
	};

	try {
		const response = await axios.get(
			'https://api.themoviedb.org/3/search/' + (movieData.mediaType || 'multi') + '?include_adult=false&language=en-US&page=1&query=' + encodeURIComponent(movie) + (movieData.releaseYear ? '&year=' + movieData.releaseYear : ''),
			tmdbOptions
		);
		const results = response.data.results;
		if (!results || results.length === 0) return fallback;
		let result = results[resultIndex];
		
		if (result) {
			const title = result.title || result.name;
			const releaseDate = result.release_date || result.first_air_date;
			const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
			const titleYear = title + ' (' + (year || result.media_type) + ')';
			
			return {
				id: result.id,
				title,
				googleTitle: movieData.googleTitle,
				releaseDate,
				releaseYear: year,
				mediaType: result.media_type,
				dateAdded: Date.now(),
				googleSearchUrl: 'https://google.ca/search?q=' + encodeURIComponent(title)
			};
		}
	} catch (err) {
		console.error(err);
	}
	return fallback;
}

// Process a list of movies, skipping those already in cache.
async function collectMovieData(movies, cachedData = []) {
	console.log(`Querying TMDB for ${movies.length} movies...`);

	const cachedMap = cachedData.reduce((map, movie) => {
		map[slugify(movie.googleTitle)] = movie;
		return map;
	}, {});

	const movieData = [];
	for (let i = 0; i < movies.length; i += 5) {
		const batch = movies.slice(i, i + 5);
		const batchPromises = batch.map(movieTitle => {
			const key = slugify(movieTitle);
			if (cachedMap[key] && !overrideCache) {
				console.log(`Skipping cached: ${movieTitle}`);
				return Promise.resolve(cachedMap[key]);
			} else {
				console.log(`Querying: ${movieTitle}`);
				return fetchMovieData(movieTitle, {googleTitle: movieTitle});
			}
		});
		const batchResults = await Promise.all(batchPromises);
		movieData.push(...batchResults.filter(result => result));
		await new Promise(resolve => setTimeout(resolve, 25));
	}

	return movieData;
}

// Combine new data with cached data, preserving dateAdded.
function combineWatchlists(newData, cachedData) {
	const cachedById = cachedData.reduce((map, movie) => {
		map[movie.id] = movie;
		return map;
	}, {});

	return newData.map(movie => {
		if (cachedById[movie.id]) return { ...movie, dateAdded: cachedById[movie.id].dateAdded };
		return movie;
	});
}

// Create the unknowns file – includes items with mediaType "person", id 0, or duplicates.
async function createUnknownsFile(data) {
	const people = data.filter(item => item.mediaType === 'person');
	const unmatched = data.filter(item => item.id === 0);
	const titleCount = {};
	const duplicates = [];
	const fallback = {
		id: 0,
		releaseDate: null,
		releaseYear: null,
		//mediaType: null,
	};

	data.forEach(item => {
		const key = slugify(item.title);
		titleCount[key] = (titleCount[key] || 0) + 1;

		if (item.id === 0) {
			item.unknownStatus = 'unmatched';
		}

		if (titleCount[key] > 1) {
			item = { ...item, ...fallback };
			item.unknownStatus = 'duplicate';
			duplicates.push(item);
		}

		if (item.mediaType === 'person') {
			item = { ...item, ...fallback };
			item.unknownStatus = 'unmatched';
		}
	});

	// For each duplicate, re-query using resultIndex = 1.
	const reRunDuplicates = [];
	for (const dup of duplicates) {
		console.log(`Re-querying duplicate: ${dup.title}`);
		const fixed = await fetchMovieData(dup.title, {googleTitle: dup.googleTitle}, 1);
		reRunDuplicates.push(fixed && fixed.id !== dup.id ? fixed : dup);
	}

	const unknowns = [...people, ...unmatched, ...reRunDuplicates];
	console.log(`Found ${unknowns.length} unknown items.`);
	const unknownsData = { generated: Date.now(), data: unknowns };
	fs.writeFileSync(unknownsFile, JSON.stringify(unknownsData, null, 2));
}

module.exports = {
	scrapeWatchlist,
	fetchMovieData,
	collectMovieData,
	combineWatchlists,
	createUnknownsFile
};
