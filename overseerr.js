/**
 * This module sends a media request to the Overseerr API
 */

const axios = require('axios');
const { updateMovie } = require('./operations');

async function sendOverseerrRequest(movie) {
	const payload = {
		mediaId: parseInt(movie.id),
		mediaType: movie.mediaType,
		userId: 8
	};

	console.log(payload);
	
	try {
		const response = await axios.post(
			process.env.OVERSEERR_URL + '/api/v1/request',
			payload,
			{
				headers: {
					'Content-Type': 'application/json',
					'X-Api-Key': process.env.OVERSEERR_API_KEY
				}
			}
		);
		updateMovie(movie.uuid, {status:{overseerr: true}});
		console.log('Overseerr response:', response.data);
		
		return response.data;
	} catch (error) {
		console.error('Error sending Overseerr request:', error.response ? error.response.data : error.message);
		throw error;
	}
}

module.exports = {
	sendOverseerrRequest
};
