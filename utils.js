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


function svgIcon(name, classes = '') {
	let svg = '';
	const icons = {
		check: '<svg class="ic-check check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M448 130L431 147 177.5 399.2l-16.9 16.9-16.9-16.9L17 273.1 0 256.2l33.9-34 17 16.9L160.6 348.3 397.1 112.9l17-16.9L448 130z"/></svg>',
		x: '<svg class="ic-x x" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M345 137l17-17L328 86.1l-17 17-119 119L73 103l-17-17L22.1 120l17 17 119 119L39 375l-17 17L56 425.9l17-17 119-119L311 409l17 17L361.9 392l-17-17-119-119L345 137z"></path></svg>',
		spinner: '<svg class="ic-spinner spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path opacity=".4" d="M0 256C0 397.4 114.6 512 256 512c94.7 0 177.5-51.5 221.7-128l-55.4-32c-33.2 57.4-95.2 96-166.3 96C150 448 64 362 64 256S150 64 256 64l0-64C114.6 0 0 114.6 0 256z"/><path d="M477.7 384c21.8-37.7 34.3-81.4 34.3-128C512 114.6 397.4 0 256 0l0 64c106 0 192 86 192 192c0 35-9.4 67.8-25.7 96l55.4 32z"/></svg>',
		search: '<svg class="ic-search" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M368 208A160 160 0 1 0 48 208a160 160 0 1 0 320 0zM337.1 371.1C301.7 399.2 256.8 416 208 416C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208c0 48.8-16.8 93.7-44.9 129.1l124 124 17 17L478.1 512l-17-17-124-124z"/></svg>',
		download: '<svg class="ic-download" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M241 345l-17 17-17-17L79 217l-17-17L96 166.1l17 17 87 87L200 24l0-24 48 0 0 24 0 246.1 87-87 17-17L385.9 200l-17 17L241 345zM48 344l0 120 352 0 0-120 0-24 48 0 0 24 0 144 0 24-24 0L24 512 0 512l0-24L0 344l0-24 48 0 0 24z"/></svg>',
		refresh: '<svg class="ic-refresh" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M94 187.1C120.8 124.1 183.3 80 256 80c39.7 0 77.8 15.8 105.9 43.9L414.1 176 360 176l-24 0 0 48 24 0 112 0 24 0 0-24 0-112 0-24-48 0 0 24 0 54.1L395.9 89.9C358.8 52.8 308.5 32 256 32C163.4 32 83.9 88.2 49.8 168.3L94 187.1zM64 369.9l52.1 52.1C153.2 459.2 203.5 480 256 480c92.5 0 171.8-56 206-135.9l-44.1-18.9C391 388.1 328.6 432 256 432c-39.7 0-77.8-15.8-105.9-43.9L97.9 336l54.1 0 24 0 0-48-24 0L40 288l-24 0 0 24 0 112 0 24 48 0 0-24 0-54.1z"></path></svg>',
		external: '<svg class="ic-external" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M328 0L304 0l0 48 24 0 102.1 0L207 271l-17 17L224 321.9l17-17 223-223L464 184l0 24 48 0 0-24 0-160 0-24L488 0 328 0zM24 32L0 32 0 56 0 488l0 24 24 0 432 0 24 0 0-24 0-176 0-24-48 0 0 24 0 152L48 464 48 80l152 0 24 0 0-48-24 0L24 32z"></path></svg>',
		grid: '<svg class="ic-grid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M0 32l128 0 0 128L0 160 0 32zM0 192l128 0 0 128L0 320 0 192zM128 352l0 128L0 480 0 352l128 0zM160 32l128 0 0 128-128 0 0-128zM288 192l0 128-128 0 0-128 128 0zM160 352l128 0 0 128-128 0 0-128zM448 32l0 128-128 0 0-128 128 0zM320 192l128 0 0 128-128 0 0-128zM448 352l0 128-128 0 0-128 128 0z"></path></svg>',
		form: '<svg class="ic-form" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M0 32l448 0 0 448L0 480 0 32zM96 288a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm32-128a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM96 384a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm96-248l-24 0 0 48 24 0 160 0 24 0 0-48-24 0-160 0zm0 96l-24 0 0 48 24 0 160 0 24 0 0-48-24 0-160 0zm0 96l-24 0 0 48 24 0 160 0 24 0 0-48-24 0-160 0z"></path></svg>',
		hamburger: '<svg class="ic-hamburger ham" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M0 64l448 0 0 48L0 112 0 64zM0 224l448 0 0 48L0 272l0-48zM448 384l0 48L0 432l0-48 448 0z"></path></svg>'
	};

	if (icons[name] !== undefined) {
		svg = icons[name];
		let search = 'class="ic-' + name;

		// add classnames if there are any
		svg = svg.replace(search, search + ' ' + classes);
	}

	return svg;
}
  
module.exports = {
	slugify,
	normalize,
	jsonForFile,
	deepMerge,
	getRelativeTimeString,
	svgIcon
};