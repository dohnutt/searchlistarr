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
  
module.exports = {
	slugify,
	normalize,
	jsonForFile,
	deepMerge
};