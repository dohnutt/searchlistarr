document.querySelectorAll('form.movie').forEach(form => {
	form.addEventListener('submit', queryTmdb);
	form.querySelector('.js-request').addEventListener('click', requestToOverseerr);
});

document.getElementById('full-run').addEventListener('submit', fullRescrape);

function queryTmdb(e) {
	e.preventDefault();
	let form = e.target;
	let button = e.submitter;
	startLoad(button);

	fetch(form.action,
		{
			method: form.method,
			body: JSON.stringify(new FormData(form)),
			headers: {'Content-Type': 'application/json'}
		})
		.then(res => res.body)
		.finally(() => endLoad(button))
		.catch(err => console.error(err))
	
	return false;
}

function requestToOverseerr(e) {
	let form = e.target.closest('form');
	let button = e.target;

	startLoad(button);
	console.log(e);
	fetch('/request', {method: 'post', body: new FormData(form)})
		.finally(() => endLoad(button))
		.catch(err => console.error(err))
	
	return false;
}

function fullRescrape(e) {
	e.preventDefault();
	let form = e.target;
	let button = e.submitter;

	startLoad(button);
	console.log(e);
	fetch(form.action, {method: form.method, body: new FormData(form)})
		.finally(() => {
			endLoad(button);
			window.location.reload();
		})
		.catch(err => console.error(err));

	return false;
}

function startLoad(button) {
	button.querySelector('.loader').classList.remove('dn');
}

function endLoad(button) {
	setTimeout(() => {
		button.querySelector('.loader').classList.add('dn');
	}, 1000);
}