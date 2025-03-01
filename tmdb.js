/**
 * This module encapsulates the logic to scrape the watchlist, query TMDB, and process duplicates/unknowns.
 */

const fs = require('fs');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { v4: uuidv4 } = require('uuid');
const { slugify, deepMerge } = require('./utils');

const googleWatchlistUrl = process.env.GOOGLE_WATCHLIST_URL;
const overrideCache = process.env.OVERRIDE_CACHE || false;

// Scrape Google Watchlist
async function scrapeGoogleWatchlist() {
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
async function fetchMovieData(movieTitle, movieData = {}) {
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
			known: false,
			tmdb: false,
			overseerr: false,
		},
		unknownState: 'unmatched'
	};

	try {
		const response = await axios.get(
			'https://api.themoviedb.org/3/search/' + (movieData.mediaType || 'multi') + '?include_adult=false&language=en-US&page=1&query=' + encodeURIComponent(movieTitle) + (movieData.releaseYear ? '&year=' + movieData.releaseYear : ''),
			{
				headers: {
					accept: 'application/json',
					Authorization: 'Bearer ' + process.env.TMDB_API_TOKEN
				}
			}
		);
		const results = response.data.results;
		if (!results || results.length === 0) return fallback;

		const result = results[0];
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
			},
			unknownState: null,
		};
	} catch (err) {
		console.error(err);
	}
	return fallback;
}

// Process a list of scraped movie titles by querying TMDB,
// but if a movie was already cached (matched by both title and occurrence index),
// skip re-querying it.
async function collectMovieData(scrapedTitles, cachedMovies = []) {
    console.log(`Querying TMDB for ${scrapedTitles.length} movies...`);

    // Create a lookup for cached movies keyed by slugified title.
    // Instead of a single value, each key holds an array of movies
    // so that duplicate titles can be stored in order.
    const cachedMap = cachedMovies.reduce((map, movie) => {
        // Use the slugified googleTitle as the key.
        const key = slugify(movie.googleTitle);
        // If this title hasn't been seen, create an empty array.
        if (!map[key]) {
            map[key] = [];
        }
        // Add this movie to the array.
        map[key].push(movie);
        return map;
    }, {});

    const scrapedCounts = {}; // Track how many times we’ve seen a given title in the scraped data.
    const moviesWithData = []; // Array to hold the resulting movie data.

    // Process the scraped titles in batches of 5 to avoid hitting rate limits.
    for (let i = 0; i < scrapedTitles.length; i += 5) {
        // Slice the next batch (up to 5 titles).
        const batch = scrapedTitles.slice(i, i + 5);

        // Map each title in the batch to a promise that either returns cached data
        // or fetches new data from TMDB.
        const batchPromises = batch.map((movieTitle) => {
            // Create a slug key from the movie title.
            const key = slugify(movieTitle);

            // Increase the occurrence counter for this title.
            scrapedCounts[key] = (scrapedCounts[key] || 0) + 1;
            // The occurrence index for the current movie.
            const occurrenceIndex = scrapedCounts[key];

            // Check if a cached movie exists for this title and occurrence.
            // We assume cached movies were stored in the same order as they appeared.
            let cachedMovie = undefined;
            if (cachedMap[key] && cachedMap[key].length >= occurrenceIndex) {
                cachedMovie = cachedMap[key][occurrenceIndex - 1]; // adjust for 0-indexing
            }

            // If we found a cached movie and overrideCache is false, skip querying.
            if (cachedMovie && !overrideCache) {
                console.log(`Skipping cached: ${movieTitle}`);
                // Wrap the cached movie in a resolved promise.
                return Promise.resolve(cachedMovie);
            } else {
                console.log(`Querying: ${movieTitle}`);
                // Query TMDB for fresh metadata.
                return fetchMovieData(movieTitle, { googleTitle: movieTitle });
            }
        });

        // Wait for all queries (or cache hits) in this batch to finish.
        const batchResults = await Promise.all(batchPromises);

        // Filter out any null/undefined responses and add the results to our final array.
        moviesWithData.push(...batchResults.filter(result => result));

        // Add a small delay (25ms) between batches to avoid API rate limits.
        await new Promise(resolve => setTimeout(resolve, 25));
    }

    // Return the final array of movie data.
    return moviesWithData;
}

// Create the unknowns list – includes items with mediaType="person", id=0, or missing releaseYear,
// or items that appear as duplicates, unless they have been corrected
// i.e. status.known && status.tmdb === true
async function createUnknownlist(movies) {
	let unknownlist = []
	
	movies.forEach(m => {
		const isUnknown =
			m.status.known === false ||
			m.status.tmdb === false ||
			(m.unknownState && m.unknownState.length);

		if (isUnknown) {
			unknownlist.push(m);
		}
	});
	
    return unknownlist;
}



module.exports = {
	scrapeGoogleWatchlist,
	fetchMovieData,
	collectMovieData,
	createUnknownlist
};
