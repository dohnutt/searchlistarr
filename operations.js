/**
 * This module encapsulates the logic to scrape the watchlist, query TMDB, and process duplicates/unknowns.
 */

const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { slugify, jsonForFile, deepMerge } = require('./utils');

const googleWatchlistUrl = process.env.GOOGLE_WATCHLIST_URL;
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

module.exports = {
	updateMovie,
	removeMovie
};
