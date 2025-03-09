document.querySelector('.burg').addEventListener('click', toggleNav);
document.getElementById('full-run').addEventListener('submit', fullRescrape);

document.querySelectorAll('form.movie').forEach(form => {
	form.addEventListener('submit', queryTmdb);
	if (form.querySelector('.js-request')) {
		form.querySelector('.js-request').addEventListener('click', requestToOverseerr);
	}
});

if (document.getElementById('settings')) {
	document.getElementById('settings').addEventListener('submit', saveSettings);
}

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
	fetch('/request',
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
	const dialog = document.getElementById('busy');

	startLoad(button);
	dialog.showModal();
	fetch(form.action,
		{
			method: form.method,
			body: JSON.stringify(Object.fromEntries(data.entries())),
			headers: {'Content-Type': 'application/json'}
		})
		.then(response => response.json())
		.then(result => {
			dialog.close();
			if (result.success) {
				doSuccessButton(button);
			} else {
				doErrorButton(button);
				throw new Error(result.success, result.data);
			}
		})
		.finally(() => endLoad(button))
		.catch(err => console.error(err));

	return false;
}

function saveSettings(e) {
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

function startLoad(button) {
	//button.querySelector('svg.x').innerHTML = checkSvg;
	button.querySelectorAll('.icon').forEach(icon => icon.classList.add('dn'));
	button.querySelector('.loader').classList.remove('dn');
}

function endLoad(button) {
	button.querySelector('.loader').classList.add('dn');
	button.querySelector('.check-icon').classList.remove('dn');
	setTimeout(() => {
		button.classList.remove('loaded', 'errored')
		button.querySelector('.check-icon').classList.add('dn');
		button.querySelector('.main-icon').classList.remove('dn');
	}, 5000);
}

function doSuccessButton(button) {
	button.classList.add('loaded');
	button.querySelector('svg.check').outerHTML = checkSvg;
}

function doErrorButton(button) {
	button.classList.add('errored');
	button.querySelector('svg.check').outerHTML = xSvg;
}