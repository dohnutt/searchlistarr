/**
 * This is the main Express app. It both runs the scheduled process (scraping, TMDB, duplicate handling) and serves a simple WebUI to manage unknowns and resubmit requests to Overseerr.
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const { scrapeWatchlist, collectMovieData, combineWatchlists, createUnknownsFile } = require('./tmdb');
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
app.use(bodyParser.urlencoded({ extended: true }));
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

	res.render('index', { unknowns: unknownsData.data, watchlist: watchlistData.data.length });
});

// Form submission endpoint to update unknown and re-query TMDB, then send Overseerr request.
app.post('/query', async (req, res) => {
	console.log(req);
	const { id, title, releaseYear } = req.body;
	console.log(`Update received for: ${title} (${releaseYear}) with TMDB ID: ${id}`);

	// temporarily returning early.
	return true;

	// Re-query TMDB with updated info.
	const updated = await collectMovieData([title], []); // second argument is empty cache here
	const updatedMovie = updated && updated.length ? updated[0] : null;
	if (!updatedMovie) {
		return res.send('Failed to update record from TMDB.');
	}

	// Update local watchlist cache
	let cached = { data: [] };
	try {
		cached = JSON.parse(fs.readFileSync(watchlistFile, 'utf8'));
	} catch (e) {
		console.error('Error reading watchlist file:', e);
		console.log('⚠️ Creating ' + watchlistFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(watchlistFile, JSON.stringify(cached));
	}
	cached.data = cached.data.map(item => {
		if (slugify(item.title) === slugify(title)) {
			return { ...item, ...updatedMovie };
		}
		return item;
	});
	
	fs.writeFileSync(watchlistFile, JSON.stringify(cached, null, 2));

	// Remove from unknowns cache
	let unknowns = { data: [] };
	try {
		unknowns = JSON.parse(fs.readFileSync(unknownsFile, 'utf8'));
	} catch (e) {
		console.error('Error reading unknowns file:', e);
		console.log('⚠️ Creating ' + unknownsFile + ' from scratch. Re-run to try again.');
		fs.writeFileSync(unknownsFile, JSON.stringify(unknowns));
	}
	unknowns.data = unknowns.data.filter(item => slugify(item.title) !== slugify(title));
	fs.writeFileSync(unknownsFile, JSON.stringify(unknowns, null, 2));

	return res.status(200);
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

	res.send("Process complete. Check logs and WebUI for unknowns.");
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});