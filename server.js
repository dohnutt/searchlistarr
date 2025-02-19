/**
 * This is the main Express app. It both runs the scheduled process (scraping, TMDB, duplicate handling) and serves a simple WebUI to manage unknowns and resubmit requests to Overseerr.
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const { scrapeWatchlist, collectMovieData, combineWatchlists, createUnknownsFile, fetchMovieData } = require('./tmdb');
const { sendOverseerrRequest } = require('./overseerr');
const { slugify } = require('./utils');

const app = express();
const PORT = process.env.PORT || 5155;

const watchlistFile = './cache/watchlist.json';
const unknownsFile = './cache/unknowns.json';

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parse form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Main endpoint: display unknown items
app.get('/', (req, res) => {
	let unknownsData = { data: [] };
	let watchlistData = { data: [] };

	try {
		unknownsData = JSON.parse(fs.readFileSync(unknownsFile, 'utf8'));
	} catch (e) {
		console.error('Error reading unknowns file:', e);
		console.log('⚠️ Creating ' + unknownsFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(unknownsFile, JSON.stringify(unknownsData));
	}

	try {
		watchlistData = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, JSON.stringify(watchlistData));
	}

	res.render('index', {
		title: 'Your watchlist',
		movies: watchlistData.data,
		stats: {
			watchlist: watchlistData.data.length,
			unknowns: unknownsData.data.length
		},
		nav: {
			currentPage: 'watchlist',
			overseerUrl: process.env.OVERSEERR_URL
		}
	});
});

// Main endpoint: display unknown items
app.get('/unknowns', (req, res) => {
	let unknownsData = { data: [] };
	let watchlistData = { data: [] };

	try {
		unknownsData = JSON.parse(fs.readFileSync(unknownsFile, 'utf8'));
	} catch (e) {
		console.error('Error reading unknowns file:', e);
		console.log('⚠️ Creating ' + unknownsFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(unknownsFile, JSON.stringify(unknownsData));
	}

	try {
		watchlistData = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, JSON.stringify(watchlistData));
	}

	res.render('index', {
		title: 'Unknown media',
		movies: unknownsData.data,
		stats: {
			watchlist: watchlistData.data.length,
			unknowns: unknownsData.data.length
		},
		nav: {
			currentPage: 'unknowns',
			overseerUrl: process.env.OVERSEER_URL
		}
	});
});

// Form submission endpoint to update unknown and re-query TMDB, then send Overseerr request.
app.post('/query', async (req, res) => {
	const movie = req.body;
	console.log(`Querying ${movie.title} (${movie.releaseYear}) - TMDB ID: ${movie.id}`);

	// Re-query TMDB with updated info.
	const updatedMovie = await fetchMovieData(movie.title, movie.googleTitle) || null;
	if (!updatedMovie || updatedMovie.id === 0) {
		console.log('No results for:', movie.title);
		return res.json({success: false})
	}

	console.log('Found metadata:', updatedMovie);

	// Update local watchlist cache
	let cached = { data: [] };
	try {
		cached = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, JSON.stringify(cached));
	}
	
	cached.data = cached.data.map(cachedMovie => {
		if (slugify(cachedMovie.googleTitle) == slugify(movie.googleTitle)) {
			return { ...cachedMovie, ...updatedMovie };
		}
		return cachedMovie;
	});
	
	fs.writeFileSync(watchlistFile, JSON.stringify(cached));

	// Remove from unknowns cache
	let unknowns = { data: [] };
	try {
		unknowns = JSON.parse(fs.readFileSync(unknownsFile, 'utf8'));
	} catch (e) {
		console.error('Error reading unknowns file:', e);
		console.log('⚠️ Creating ' + unknownsFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(unknownsFile, JSON.stringify(unknowns));
	}
	// remove no longer unknown data
	//unknowns.data = unknowns.data.filter(item => slugify(item.googleTitle) !== slugify(movie.googleTitle));

	unknowns.data = unknowns.data.map(unknownMovie => {
		if (slugify(unknownMovie.googleTitle) == slugify(movie.googleTitle)) {
			return { ...unknownMovie, ...updatedMovie };
		}
		return unknownMovie;
	});

	fs.writeFileSync(unknownsFile, JSON.stringify(unknowns, null, 2));

	return res.json({success: true, data: { cached: cached.data, unknowns: unknowns.data }});
});

// Form submission endpoint to update unknown and re-query TMDB
app.post('/request', async (req, res) => {
	console.log(req);
	const { id, mediaType } = req.body;
	const movie = { id: id, mediaType: mediaType };

	return;

	// Make a media request to Overseerr
	try {
		await sendOverseerrRequest(movie);
		console.log("Overseerr request sent.");
	} catch (error) {
		console.error("Error sending Overseerr request:", error);
	}

	//res.redirect('/');
	return res.send('Request complete.');
});

// A manual endpoint to run the entire process (scrape, update cache, unknowns, etc.)
app.post('/run', async (req, res) => {
	let cached = { data: [] };
	try {
		cached = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, JSON.stringify(cached));
	}

	// 1. Scrape Google Watchlist.
	const scraped = await scrapeWatchlist();

	// 2. Query TMDB (skipping movies that are in cache).
	const newData = await collectMovieData(scraped, cached.data);

	// 3. Merge with cache (this also handles duplicate resolution)
	const combined = combineWatchlists(newData, cached.data);

	// Write updated watchlist cache.
	fs.writeFileSync(watchlistFile, JSON.stringify({ generated: Date.now(), data: combined }, null, 2));

	// 4. Create unknowns file (this re-queries duplicates and stores people/id=0)
	await createUnknownsFile(combined);

	return res.json({success: true, message: "Process complete. Check logs and WebUI for unknowns."});
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});