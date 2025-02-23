/**
 * This is the main Express app. It both runs the scheduled process (scraping, TMDB, duplicate handling) and serves a simple WebUI to manage unknowns and resubmit requests to Overseerr.
 */

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { scrapeWatchlist, collectMovieData, combineWatchlists, createUnknownlist, fetchMovieData } = require('./tmdb');
const { sendOverseerrRequest } = require('./overseerr');
const { slugify, normalize, jsonForFile } = require('./utils');
const { render } = require('ejs');
const { updateMovie, removeMovie } = require('./operations');

const app = express();
const PORT = process.env.PORT || 5155;
const overrideCache = process.env.OVERRIDE_CACHE || false;

const watchlistFile = './cache/watchlist.json';
const unknownlistFile = './cache/unknownlist.json';

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parse form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Main endpoint: display unknown items
app.get('/', (req, res) => {
	let unknownsData = [],
		watchlistData = [];

	try {
		unknownsData = JSON.parse(fs.readFileSync(unknownlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading unknowns file:', e);
		console.log('⚠️ Creating ' + unknownlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(unknownlistFile, jsonForFile(unknownsData));
	}

	try {
		watchlistData = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, jsonForFile(watchlistData));
	}

	const unknownsCount = unknownsData.data.length || 0;
	const watchlistCount = watchlistData.data.length || 0;
	let pageMovies = watchlistData.data;
	let q = req.query.q || '';

	if (q.length) {
		const normalQ = normalize(q);
		pageMovies = pageMovies.filter(m => {
			return normalize(m.title).indexOf(normalQ) > -1;
		});

		console.log(`Search for ${q} returned ${pageMovies.length} results`);
	}

	res.render('index', {
		title: 'Your watchlist',
		movies: pageMovies,
		search: q,
		stats: {
			watchlist: watchlistCount,
			unknowns: unknownsCount
		},
		nav: {
			currentPage: 'watchlist',
			overseerUrl: process.env.OVERSEERR_URL
		}
	});
});

// Main endpoint: display unknown items
app.get('/unknowns', (req, res) => {
	let unknownsData = [],
		watchlistData = [];

	try {
		unknownsData = JSON.parse(fs.readFileSync(unknownlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading unknowns file:', e);
		console.log('⚠️ Creating ' + unknownlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(unknownlistFile, jsonForFile(unknownsData));
	}

	try {
		watchlistData = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, jsonForFile(watchlistData));
	}

	const unknownsCount = unknownsData.data.length || 0;
	const watchlistCount = watchlistData.data.length || 0;
	let pageMovies = unknownsData.data;
	let q = req.query.q || '';

	if (q.length) {
		const normalQ = normalize(q);
		pageMovies = pageMovies.filter(m => {
			return normalize(m.title).indexOf(normalQ) > -1;
		});

		console.log(`Search for ${q} returned ${pageMovies.length} results`);
	}

	res.render('index', {
		title: 'Unknown media',
		movies: pageMovies,
		search: q,
		stats: {
			watchlist: watchlistCount,
			unknowns: unknownsCount
		},
		nav: {
			currentPage: 'unknowns',
			overseerUrl: process.env.OVERSEERR_URL
		}
	});
});

// Form submission endpoint to update unknown and re-query TMDB
app.post('/query', async (req, res) => {
	const movie = req.body;
	console.log(`Querying ${movie.title} (${movie.releaseYear}) - TMDB ID: ${movie.id}`);

	// Re-query TMDB with updated info.
	const updatedMovie = await fetchMovieData(movie.title, movie) || null;
	if (!updatedMovie || updatedMovie.id === 0) {
		console.log('No results for:', movie.title);
		return res.json({success: false, data: 'No results for: ' + movie.title})
	}

	updateMovie(movie.uuid, updatedMovie);
	removeMovie(movie.uuid);

	return res.json({success: true, data: { updated: updatedMovie }});
});

// Endpoint to send Overseerr request
app.post('/request', async (req, res) => {
	const { uuid, id, mediaType } = req.body;
	const movie = { uuid, id, mediaType };

	try {
		await sendOverseerrRequest(movie);
		console.log('Overseerr request sent:', movie.id);
		return res.json({success: true, data: movie});
	} catch (err) {
		console.error('Error sending Overseerr request:', err);
	}

	return res.json({success: false, data: movie});
});

// A manual endpoint to run the entire process (scrape, update cache, unknowns, etc.)
app.get('/run', async (req, res) => {
	let cached = { data: [] };
	
	try {
		cached = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, jsonForFile(cached));
	}

	// 1. Scrape Google Watchlist.
	const scraped = await scrapeWatchlist();

	// 2. Query TMDB (skipping movies that are in cache).
	const newData = await collectMovieData(scraped, cached.data);

	// 3. Merge with cache (this also handles duplicate resolution)
	const combinedData = combineWatchlists(newData, cached.data);

	// Write updated watchlist cache.
	fs.writeFileSync(watchlistFile, jsonForFile(combinedData));

	// 4. Find unknowns (duplicates, id=0, mediaType=person)
	const unknownsData = await createUnknownlist(combinedData);
	fs.writeFileSync(unknownlistFile, jsonForFile(unknownsData));

	return res.json({success: true});
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});