/**
 * Utility functions, for example the slugify function.
 */

function slugify(str) {
	return str
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function normalize(string) {
	return string
		.toString()
		.toLowerCase()
		.replace(/\W+/g, '');
		//.replace(/\s+/g, '');
}

function jsonForFile(data) {
	return JSON.stringify({
		generated: Date.now(),
		data
	}, null, 2);
}
  
module.exports = {
	slugify,
	normalize,
	jsonForFile
};