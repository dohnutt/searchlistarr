/**
 * This module encapsulates the logic to scrape the watchlist, query TMDB, and process duplicates/unknowns.
 */

const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { slugify, jsonForFile, deepMerge } = require('./utils');

const overrideCache = process.env.OVERRIDE_CACHE || false;
const watchlistFile = './cache/watchlist.json';
const unknownlistFile = './cache/unknownlist.json';

// Updates given movie in both cache files
function updateMovie(uuid, movieData = {}) {
	const watchlist = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	const unknownlist = JSON.parse(fs.readFileSync(unknownlistFile, 'utf8'));
	const wIndex = watchlist.data.findIndex(item => item.uuid === uuid);
	const uIndex = unknownlist.data.findIndex(item => item.uuid === uuid);

	watchlist.data[wIndex] = deepMerge(watchlist.data[wIndex], movieData);
	unknownlist.data[uIndex] = deepMerge(unknownlist.data[uIndex], movieData);

	fs.writeFileSync(watchlistFile, jsonForFile(watchlist.data));
	fs.writeFileSync(unknownlistFile, jsonForFile(unknownlist.data));

	return true;
}

// Removes a given movie from unknownlist cache
function removeMovie(uuid) {
	const watchlist = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	const unknownlist = JSON.parse(fs.readFileSync(unknownlistFile, 'utf8'));

	//watchlist.data = watchlist.data.filter(item => item.uuid !== uuid);
	unknownlist.data = unknownlist.data.filter(item => item.uuid !== uuid);

	//fs.writeFileSync(watchlistFile, jsonForFile(watchlist.data));
	fs.writeFileSync(unknownlistFile, jsonForFile(unknownlist.data));

	return true;
}

// Combine new data with cached data, preserving dateAdded.
// Also, for movies that appear as duplicates (by googleTitle),
// if they are not already fully "known" (both status.known and status.tmdb true),
// then set status.known to false.
function mergeWatchlists(newData, cachedData) {
	// Create a lookup object from cached data keyed by movie.id.
	const cachedById = cachedData.reduce((map, movie) => {
		map[movie.id] = movie;
		return map;
	}, {});
  
	// Merge newData with cachedData to preserve dateAdded.
	let merged = newData.map(movie => {
		if (cachedById[movie.id]) {
			// If the movie exists in the cache, merge in the dateAdded.
			return { ...movie, dateAdded: cachedById[movie.id].dateAdded };
		}
		return movie;
	});
  
	// Group merged movies by a slugified version of their googleTitle to detect duplicates.
	const groups = merged.reduce((acc, movie) => {
		const key = slugify(movie.googleTitle);
		if (!acc[key]) acc[key] = [];
		acc[key].push(movie);
		return acc;
	}, {});
  
	// For each group with duplicates, adjust status.known as needed.
	Object.values(groups).forEach(group => {
		if (group.length > 1) {
			// For duplicates, if the movie's status is not both known and linked to TMDB,
			// set status.known to false.
			group.forEach(m => {
				if (!(m.status && m.status.known && m.status.tmdb)) {
					m.status.known = false;
					m.unknownState = 'duplicate';
				}
			});
		}
	});
  
	// Return the merged (and possibly updated) list.
	return merged;
}

module.exports = {
	updateMovie,
	removeMovie,
	mergeWatchlists
};
