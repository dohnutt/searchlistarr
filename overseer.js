/**
 * This module sends a media request to the Overseerr API
 */

const axios = require('axios');

async function sendOverseerrRequest(movie) {
	// Build the payload as expected by Overseerr.
	const payload = {
		mediaId: movie.id,
		mediaType: movie.mediaType, // e.g., "movie" or "tv"
		// You can add more fields as needed by Overseerr API.
	};
	
	try {
		const response = await axios.post(
			process.env.OVERSEERR_URL + '/api/v1/request',
			payload,
			{
				headers: {
					'X-Api-Key': process.env.OVERSEERR_API_KEY,
					'Content-Type': 'application/json'
				}
			}
		);

		console.log("Overseerr response:", response.data);
		
		return response.data;
	} catch (error) {
		console.error("Error sending Overseerr request:", error.response ? error.response.data : error.message);
		throw error;
	}
}

module.exports = {
	sendOverseerrRequest
};
