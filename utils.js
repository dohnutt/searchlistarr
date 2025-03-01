/**
 * Utility functions
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

function isObject(item) {
	return item !== null && typeof item === 'object' && !Array.isArray(item);
}

function deepMerge(target, ...sources) {
	if (!sources.length) return target;
	const source = sources.shift();

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (Object.prototype.hasOwnProperty.call(source, key)) {
				const sourceValue = source[key];
				if (isObject(sourceValue) && isObject(target[key])) {
					target[key] = deepMerge(target[key], sourceValue);
				} else {
					target[key] = sourceValue;
				}
			}
		}
	}

	return deepMerge(target, ...sources);
}

/**
 * Convert a date to a relative time string, such as
 * "a minute ago", "in 2 hours", "yesterday", "3 months ago", etc.
 * using Intl.RelativeTimeFormat
 */
function getRelativeTimeString(date, lang = 'en') {
	// Allow dates or times to be passed
	const timeMs = typeof date === "number" ? date : date.getTime();
  
	// Get the amount of seconds between the given date and now
	const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);
  
	// Array reprsenting one minute, hour, day, week, month, etc in seconds
	const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];
  
	// Array equivalent to the above but in the string representation of the units
	const units = ["second", "minute", "hour", "day", "week", "month", "year"];
  
	// Grab the ideal cutoff unit
	const unitIndex = cutoffs.findIndex(cutoff => cutoff > Math.abs(deltaSeconds));
  
	// Get the divisor to divide from the seconds. E.g. if our unit is "day" our divisor
	// is one day in seconds, so we can divide our seconds by this to get the # of days
	const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
  
	// Intl.RelativeTimeFormat do its magic
	const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
	return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
}
  
module.exports = {
	slugify,
	normalize,
	jsonForFile,
	deepMerge,
	getRelativeTimeString
};