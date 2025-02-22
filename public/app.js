document.querySelector('.burg').addEventListener('click', toggleNav);
document.getElementById('full-run').addEventListener('submit', fullRescrape);

document.querySelectorAll('form.movie').forEach(form => {
	form.addEventListener('submit', queryTmdb);
	form.querySelector('.js-request').addEventListener('click', requestToOverseerr);
});

const checkSvg = '<svg class="check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M448 130L431 147 177.5 399.2l-16.9 16.9-16.9-16.9L17 273.1 0 256.2l33.9-34 17 16.9L160.6 348.3 397.1 112.9l17-16.9L448 130z"/></svg>';
const xSvg = '<svg class="x" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M326.6 166.6L349.3 144 304 98.7l-22.6 22.6L192 210.7l-89.4-89.4L80 98.7 34.7 144l22.6 22.6L146.7 256 57.4 345.4 34.7 368 80 413.3l22.6-22.6L192 301.3l89.4 89.4L304 413.3 349.3 368l-22.6-22.6L237.3 256l89.4-89.4z"/></svg>';

function toggleNav(e) {
	document.querySelector('nav').classList.toggle('open');
	this.querySelector('.ham').classList.toggle('dn');
	this.querySelector('.x').classList.toggle('dn');
}

function queryTmdb(e) {
	e.preventDefault();
	const form = e.target;
	const button = e.submitter;
	const data = new FormData(form);

	startLoad(button);
	fetch(form.action,
		{
			method: form.method,
			body: JSON.stringify(Object.fromEntries(data.entries())),
			headers: {'Content-Type': 'application/json'}
		})
		.then(response => response.json())
		.then(result => {
			if (result.success) {
				doSuccessButton(button);
			} else {
				doErrorButton(button);
				throw new Error(result.data);
			}
		})
		.finally(() => endLoad(button))
		.catch(err => console.error(err))
	
	return false;
}

function requestToOverseerr(e) {
	const form = e.target.closest('form');
	const button = e.target || this;
	const data = new FormData(form);

	startLoad(button);

	fetch('/request', {
		method: form.method,
		body: JSON.stringify(Object.fromEntries(data.entries())),
		headers: {'Content-Type': 'application/json'}
	})
		.then(response => response.json())
		.then(result => {
			console.log(result);
			if (result.success) {
				doSuccessButton(button);
			} else {
				doErrorButton(button);
				throw new Error(result.success, result.data);
			}
		})
		.finally(() => endLoad(button))
		.catch(err => console.error(err))
	
	return false;
}

function fullRescrape(e) {
	e.preventDefault();
	const form = e.target;
	const button = e.submitter;
	const data = new FormData(form);

	startLoad(button);
	fetch(form.action, { method: form.method, headers: {'Content-Type': 'application/json'} })
		.then(response => response.json())
		.then(result => {
			console.log(result);
			if (result.success) {
				doSuccessButton(button);
			} else {
				doErrorButton(button);
				throw new Error(result.success, result.data);
			}
		})
		.finally(() => {
			endLoad(button);
		})
		.catch(err => console.error(err));

	return false;
}

function startLoad(button) {
	//button.querySelector('svg.x').innerHTML = checkSvg;
	button.querySelector('.loader').classList.remove('dn');
}

function endLoad(button) {
	button.querySelector('.loader').classList.add('dn');
	setTimeout(() => button.classList.remove('loaded', 'errored'), 5000);
}

function doSuccessButton(button) {
	button.classList.add('loaded');
	console.log(button);
	button.querySelector('svg.check').outerHTML = checkSvg;
}

function doErrorButton(button) {
	button.classList.add('errored');
	button.querySelector('svg.check').outerHTML = xSvg;
}