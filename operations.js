/**
 * This module encapsulates the logic to scrape the watchlist, query TMDB, and process duplicates/unknowns.
 */

const fs = require('fs');
const { slugify, jsonForFile, deepMerge } = require('./utils');

const skipCache = process.env.SKIP_CACHE || false;
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

// Combine new data with cached data, preserving all cached properties.
// Also, for movies that appear as duplicates (by googleTitle),
// if they are not already fully "known" (both status.known and status.tmdb true),
// then set status.known to false.
function mergeWatchlists(newData, cachedData, skipCache = false) {
	if (skipCache) {
		return newData;
	}

	// Group the cached movies by a slugified version of their googleTitle.
	// Each key will map to an array of cached movies in the order they appear.
	const cachedGroups = cachedData.reduce((groups, movie) => {
		const key = slugify(movie.googleTitle);
		if (!groups[key]) groups[key] = [];
		groups[key].push(movie);
		return groups;
	}, {});
  
	// Similarly, group the new data by the slugified googleTitle.
	const newGroups = newData.reduce((groups, movie) => {
		const key = slugify(movie.googleTitle);
		if (!groups[key]) groups[key] = [];
		groups[key].push(movie);
		return groups;
	}, {});
  
	// This array will hold the merged movie objects.
	const merged = [];
  
	// For each group in the new data, merge each movie with the corresponding cached movie (if any)
	Object.keys(newGroups).forEach(key => {
		const newMovies = newGroups[key];
		// Get the corresponding group from the cache (or an empty array if none exists)
		const cachedMovies = cachedGroups[key] || [];
		
		// For each occurrence (index) in the new movies:
		newMovies.forEach((newMovie, index) => {
			let mergedMovie = newMovie;
			// If there is a cached movie at this occurrence index, merge it in.
			if (index < cachedMovies.length) {
				// This merge preserves all cached properties.
				// Cached data takes precedence, so manual corrections persist.
				mergedMovie = { ...newMovie, ...cachedMovies[index] };
			}
			merged.push(mergedMovie);
		});
	});
  
	// Now, re-group the merged movies by slugified googleTitle to detect duplicates.
	const groups = merged.reduce((acc, movie) => {
		const key = slugify(movie.googleTitle);
		if (!acc[key]) acc[key] = [];
		acc[key].push(movie);
		return acc;
	}, {});
  
	// For each group with duplicates, check the status.
	// If a movie in the group is not fully corrected (i.e. not both status.known and status.tmdb),
	// then set status.known to false and mark its unknownState.
	Object.values(groups).forEach(group => {
		if (group.length > 1) {
			group.forEach(movie => {
				if (!(movie.status && movie.status.known && movie.status.tmdb)) {
					// Force the movie to be marked as not known.
					movie.status = { ...movie.status, known: false };
					movie.unknownState = 'duplicate';
				}
			});
		}
	});
  
	return merged;
}  

module.exports = {
	updateMovie,
	removeMovie,
	mergeWatchlists
};
