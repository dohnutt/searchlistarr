# Searchlistarr

⚠️ Still a WIP.

Scrapes your [Google Watchlist](https://www.google.com/search?q=my+watchlist), queries [TMDB](https://www.themoviedb.org/), and submits requests to your Overseerr instance.

---

## Get started

You will need the following:

### 1. Copy `.env.example` to `.env`

Set up your `.env` file by copying the example and renaming it to `.env`

### 2. Get your publicly-accessible Google Watchlist URL.

Find and open your Google watchlist here: [https://www.google.com/interests/saved](https://www.google.com/interests/saved)

Click the "Share" button, choose "View only link", and click "Continue". Copy the resulting link and paste into `GOOGLE_WATCHLIST_URL` in your `.env` file.

### 3. Get a TMDB auth token

Sign up with TMDB and request an [authorization token](https://developer.themoviedb.org/reference/intro/getting-started). Paste the token into `TMDB_API_TOKEN` in your `.env` file.

### 2. Get your Overseerr API key and URL

In your Overseerr instance, copy your API key (Settings > General > API Key), and paste it into `OVERSEERR_API_KEY` in your `.env` file.

While you're there, also copy the local URL to your Overseerr instance. Paste it into `OVERSEERR_URL` in your `.env` file.