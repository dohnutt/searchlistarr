/**
 * This module encapsulates the logic to scrape the watchlist, query TMDB, and process duplicates/unknowns.
 */

const fs = require('fs');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { v4: uuidv4 } = require('uuid');
const { slugify } = require('./utils');
const { updateMovie } = require('./operations');

const googleWatchlistUrl = process.env.GOOGLE_WATCHLIST_URL;
const overrideCache = process.env.OVERRIDE_CACHE || false;

// Scrape Google Watchlist
async function scrapeWatchlist() {
	let document = {};
	let items = [];
	let prevFirstItem = null;
	console.log('Scraping Google Watchlist...');

	for (let i = 0; i <= 5; i++) {
		try {
			const response = await axios.get(`${googleWatchlistUrl}?pageNumber=${i + 1}`, {
				headers: {'User-Agent': 'Mozilla/5.0'}
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
async function fetchMovieData(movieTitle, movieData = {}, resultIndex = 0) {
	// https://developer.themoviedb.org/docs/image-basics
	const tmdbImg = 'https://image.tmdb.org/t/p/' + 'w300';
	const fallback = {
		uuid: uuidv4(),
		id: 0,
		title: movieTitle,
		googleTitle: movieData.googleTitle,
		releaseDate: null,
		releaseYear: null,
		mediaType: null,
		posterImg: '',
		dateAdded: Date.now(),
		googleSearchUrl: 'https://google.ca/search?q=' + encodeURIComponent(movieTitle),
		status: {
			known: true,
			tmdb: false,
			overseerr: false,
		}
	};

	try {
		const response = await axios.get(
			'https://api.themoviedb.org/3/search/' + (movieData.mediaType || 'multi') + '?include_adult=false&language=en-US&page=1&query=' + encodeURIComponent(movieTitle) + (movieData.releaseYear ? '&year=' + movieData.releaseYear : ''),
			{
				method: 'GET',
				headers: {
					accept: 'application/json',
					Authorization: 'Bearer ' + process.env.TMDB_API_TOKEN
				}
			}
		);
		const results = response.data.results;
		if (!results || results.length === 0) return fallback;
		const result = results[resultIndex];
		if (result) {
			const title = result.title || result.name;
			const releaseDate = result.release_date || result.first_air_date;
			const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
			const titleYear = title + ' (' + (year || result.media_type) + ')';
			
			return {
				uuid: movieData.uuid || uuidv4(),
				id: result.id,
				title,
				googleTitle: movieData.googleTitle,
				releaseDate,
				releaseYear: year,
				mediaType: result.media_type || movieData.mediaType,
				posterImg: result.poster_path ? tmdbImg + result.poster_path : null,
				dateAdded: Date.now(),
				googleSearchUrl: 'https://google.ca/search?q=' + encodeURIComponent(titleYear),
				status: {
					known: true,
					tmdb: true,
					overseerr: false,
				}
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
async function createUnknownlist(data) {
	const fallback = {
		id: 0,
		releaseDate: null,
		releaseYear: null,
	};

	// Group items by slugified googleTitle.
	const groups = {};
	data.forEach(item => {
		const key = slugify(item.googleTitle);
		if (!groups[key]) {
			groups[key] = [];
		}
		groups[key].push(item);
	});

	// Build a flat array of unknowns.
	const unknowns = [];
	for (const key in groups) {
		const group = groups[key];
		if (group.length > 1) {
			// Group has duplicates; update each item and add them consecutively.
			group.forEach(item => {
				const updated = { ...item, ...fallback };
				updated.unknownStatus = 'duplicate';
				updated.googleSearchUrl =
					'https://google.ca/search?q=' + encodeURIComponent(item.googleTitle);
				unknowns.push(updated);
			});
		} else {
			// Single item group.
			const item = group[0];
			if (item.id === 0 || item.mediaType === 'person') {
				const updated = { ...item, ...fallback };
				updated.unknownStatus = 'unmatched';
				updated.googleSearchUrl =
					'https://google.ca/search?q=' + encodeURIComponent(item.googleTitle);
				unknowns.push(updated);
			} else {
				if (item.unknownStatus) {
					unknowns.push(item);
				}
			}
		}
	}

	console.log(`Found ${unknowns.length} unknown items (flat array with duplicates grouped).`);
	return unknowns;
}



module.exports = {
	scrapeWatchlist,
	fetchMovieData,
	collectMovieData,
	combineWatchlists,
	createUnknownlist
};
