/**
 * This is the main Express app. It both runs the scheduled process (scraping, TMDB, duplicate handling) and serves a simple WebUI to manage unknowns and resubmit requests to Overseerr.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const { scrapeGoogleWatchlist, collectMovieData, createUnknownlist, fetchMovieData } = require('./tmdb');
const { sendOverseerrRequest } = require('./overseerr');
const { normalize, jsonForFile, getRelativeTimeString, svgIcon } = require('./utils');
const { updateMovie, removeMovie, mergeWatchlists } = require('./operations');


const settingsFile = './cache/settings.json';
const watchlistFile = './cache/watchlist.json';
const unknownlistFile = './cache/unknownlist.json';
const perPage = 100;

const app = express();
const PORT = process.env.PORT || 5155;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Main endpoint: display unknown items
app.get('/', (req, res) => {
	let settingsData = [],
		unknownsData = [],
		watchlistData = [];

	try {
		settingsData = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
	} catch (e) {
		console.error('Error reading settings file:', e);
		console.log('⚠️ Creating ' + settingsFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(settingsFile, jsonForFile(settingsData));
	}

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

	let viewGrid = parseInt(req.query.grid || req.cookies['grid']) ? 1 : 0;
	res.cookie('grid', viewGrid);

	let q = req.query.q || '';
	if (q.length) {
		const normalQ = normalize(q);
		pageMovies = pageMovies.filter(m => {
			return normalize(m.title).indexOf(normalQ) > -1;
		});

		console.log(`Search for ${q} returned ${pageMovies.length} results`);
	}

	const totalPages = Math.ceil(pageMovies.length / perPage);
	let currentPage = parseInt(req.query.p) || 0,
		pageOffset = currentPage * perPage;
	pageMovies = pageMovies.splice(pageOffset, perPage);

	res.render('index', {
		title: 'Your watchlist',
		movies: pageMovies,
		search: q,
		grid: viewGrid,
		pagination: {
			current: currentPage,
			total: totalPages,
			prev: currentPage - 1,
			next: currentPage + 1,
		},
		stats: {
			watchlist: watchlistCount,
			unknowns: unknownsCount
		},
		nav: {
			currentUrl: '/',
			currentUrlWithView: '/?grid=' + viewGrid,
			currentPage: 'watchlist',
			overseerUrl: process.env.OVERSEERR_URL
		},
		settings: settingsData.data,
		utils: { svgIcon },
	});
});

// Display unknown items
app.get('/unknowns', (req, res) => {
	let settingsData = [],
		unknownsData = [],
		watchlistData = [];

	try {
		settingsData = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
	} catch (e) {
		console.error('Error reading settings file:', e);
		console.log('⚠️ Creating ' + settingsFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(settingsFile, jsonForFile(settingsData));
	}

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

	let viewGrid = parseInt(req.query.grid || req.cookies['grid']) ? 1 : 0;
	res.cookie('grid', viewGrid);
	
	let q = req.query.q || '';
	if (q.length) {
		const normalQ = normalize(q);
		pageMovies = pageMovies.filter(m => {
			return normalize(m.title).indexOf(normalQ) > -1;
		});

		console.log(`Search for ${q} returned ${pageMovies.length} results`);
	}

	const totalPages = Math.ceil(pageMovies.length / perPage);
	let currentPage = parseInt(req.query.p) || 0,
		pageOffset = currentPage * perPage;
	pageMovies = pageMovies.splice(pageOffset, perPage);

	res.render('index', {
		title: 'Unknown media',
		movies: pageMovies,
		search: q,
		grid: viewGrid,
		pagination: {
			current: currentPage,
			total: totalPages,
			prev: currentPage - 1,
			next: currentPage + 1,
		},
		stats: {
			watchlist: watchlistCount,
			unknowns: unknownsCount
		},
		nav: {
			currentUrl: '/unknowns',
			currentUrlWithView: '/unknowns?grid=' + viewGrid,
			currentPage: 'unknowns',
			overseerUrl: process.env.OVERSEERR_URL
		},
		settings: settingsData.data,
		utils: { svgIcon },
	});
});

// Display settings
app.get('/settings', (req, res) => {
	let settingsData = [],
		unknownsData = [],
		watchlistData = [];

	try {
		settingsData = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
	} catch (e) {
		console.error('Error reading settings file:', e);
		console.log('⚠️ Creating ' + settingsFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(settingsFile, jsonForFile(settingsData));
	}

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

	const watchlistCount = watchlistData.data.length || 0;
	const unknownsCount = unknownsData.data.length || 0;
	const watchlistModified = getRelativeTimeString(new Date(watchlistData.generated));
	const unknownlistModified = getRelativeTimeString(new Date(unknownsData.generated));
	const settingsModified = getRelativeTimeString(new Date(settingsData.generated));

	res.render('page', {
		title: 'Settings',
		pageTemplate: 'pages/settings.ejs',
		googleWatchlistUrl: process.env.GOOGLE_WATCHLIST_URL,
		stats: {
			watchlist: watchlistCount,
			watchlistModified,
			unknowns: unknownsCount,
			unknownlistModified,
			settingsModified,
		},
		nav: {
			currentUrl: '/settings',
			currentPage: 'settings',
			overseerUrl: process.env.OVERSEERR_URL
		},
		settings: settingsData.data,
		utils: { svgIcon },
	});
});

// Simple API endpoint to share watchlist
app.get('/api/v1/watchlist', (req, res) => {
	const watchlistData = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));

	const apiPerPage = 20;
	const currentPage = parseInt(req.query.p) || 1,
		pageOffset = (currentPage - 1) * apiPerPage;

	const movies = {
		page: currentPage,
		totalPages: Math.ceil(watchlistData.data.length / apiPerPage),
		totalResults: watchlistData.data.length,
		results: []
	};

	movies.results = watchlistData.data.map(movie => {
		return {
			title: movie.title,
			mediaType: movie.mediaType,
			tmdbId: movie.id,
		}
	});

	movies.results = movies.results.splice(pageOffset, apiPerPage);

	return res.json(movies);
});

// Form submission endpoint to update unknown and re-query TMDB
app.post('/settings', async (req, res) => {
	fs.writeFileSync(settingsFile, jsonForFile(req.body));

	return res.json({success: true});
});

// Form submission endpoint to update unknown and re-query TMDB
app.post('/query', async (req, res) => {
	const movie = req.body;
	console.log(`Querying ${movie.title} (${movie.releaseYear}) - TMDB ID: ${movie.id}`);

	// Re-query TMDB with updated info.
	const movieWithData = await fetchMovieData(movie.title, movie) || null;
	if (!movieWithData || movieWithData.id === 0) {
		console.log('No results for:', movie.title);
		return res.json({success: false, data: 'No results for: ' + movie.title})
	}

	updateMovie(movieWithData.uuid, movieWithData);
	removeMovie(movieWithData.uuid);

	return res.json({success: true, data: { updated: movieWithData }});
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
app.post('/run', async (req, res) => {
	let cached = { data: [] };
	const skipCache = process.env.SKIP_CACHE || (parseInt(req.body.force) ? true : false) || false;

	if (skipCache) {
		console.log('⚠️ Forcefully skipping cache.');
	}
	
	try {
		cached = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, jsonForFile(cached));
	}

	// 1. Scrape Google Watchlist.
	const scrapedTitles = await scrapeGoogleWatchlist();

	// 2. Query TMDB (skipping movies that are in cache).
	const moviesWithData = await collectMovieData(scrapedTitles, cached.data, skipCache);

	// 3. Combine queried data with existing cache.
	const combinedMovies = mergeWatchlists(moviesWithData, cached.data, skipCache);

	// 4. Find unknowns (duplicates, id=0, mediaType=person, releaseYear=null)
	const unknownMovies = await createUnknownlist(combinedMovies);

	// Write updated cache files
	fs.writeFileSync(watchlistFile, jsonForFile(combinedMovies));
	fs.writeFileSync(unknownlistFile, jsonForFile(unknownMovies));

	return res.json({success: true});
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});