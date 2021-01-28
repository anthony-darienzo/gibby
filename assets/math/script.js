// create canvas element and append it to document body
//var canvas = document.createElement('canvas');
var canvas = document.getElementById("wave_canvas")
document.body.appendChild(canvas);
gfa = [];

// PUT CALL SEQUENCE HERE

// some hotfixes... ( ≖_≖)
document.body.style.margin = 0;
canvas.style.position = 'fixed';

// get canvas 2D context and set him correct size
var ctx = canvas.getContext('2d');
var bounding_rect = canvas.getBoundingClientRect();
resize();

// last known position
var pos = {
    x: 0,
    y: 0
};

window.addEventListener('resize', resize);
document.addEventListener('mousemove', draw);
document.addEventListener('mousedown', setPosition);
document.addEventListener('mouseenter', setPosition);

var button = document.getElementById("sample_button_start");

button.addEventListener("click", () => {
    sample_button_enable(false);
    updateFrame()
    .then(canvas_to_fourier_series)
    .then(fourier_series_to_sound)
    .then( () => {
        sample_button_enable(true);
    });
});

// DEFINE FUNCTIONS HERE

function createComplex(real, imag) {
    return {
        real: real,
        imag: imag
    };
}

/** Returns an Array `[real_arr,imag_arr]` */
function dft(samples) {
    return new Promise( (resolve) => {
        let len = samples.length;
        let real_arr = new Float32Array(len);
        let imag_arr = new Float32Array(len);
        for (var i = 0; i < len; i++) {
            real_arr[i] = 0;
            imag_arr[i] = 0;
            for (var n = 0; n < len; n++) {
                var theta = 2 * Math.PI * i * n / len;
                var costheta = Math.cos(theta);
                var sintheta = Math.sin(theta);

                real_arr[i] += samples[n] * costheta;
                imag_arr[i] -= samples[n]* sintheta;
            }
        }
        resolve([real_arr,imag_arr]);
    });
}

/** Anything after the return promise is called AFTER the DOM is updated. */
function updateFrame() {
    return new Promise((resolve) => {
        requestAnimationFrame( () => {
            requestAnimationFrame(resolve);
        });
    });
}

// DEFINE ROUTINES HERE

// resize canvas
function resize() {
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
}

// new position from mouse event
function setPosition(e) {
    pos.x = e.clientX - bounding_rect.left;
    pos.y = e.clientY - bounding_rect.top;
}

function setPixel(imageData, x, y, r, g, b, a) {
    var index = 4 * (x + y * imageData.width);
    imageData.data[index + 0] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = a;
}

function draw(e) {
    // mouse left button must be pressed
    if (e.buttons !== 1) return;

    ctx.beginPath(); // begin

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#c0392b';

    ctx.moveTo(pos.x, pos.y); // from
    setPosition(e);
    ctx.lineTo(pos.x, pos.y); // to

    ctx.stroke(); // draw it!
}

async function canvas_to_fourier_series() {
    // After this loop, gfa is a subset of the graph of the drawn function
    for (x = 0; x <= canvas.width; x = x+3) {
        let max = -1;
        for (y = canvas.height; y >= 0; y--) {
            let pixel = ctx.getImageData(x, y, 1, 1);
            let data = pixel.data;
            if (data[0] !== 0) {
                max = y;
            }
        }
        gfa.push(max);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Let's grab only the nontrivial points
    let first_nontrivial_index = gfa.length;
    for (x = 0; x <= first_nontrivial_index; x++) {
        if (gfa[x] >= 0 )
            first_nontrivial_index = x;
    }
    let last_nontrivial_index = 0;
    for (x = gfa.length; x >= last_nontrivial_index; x--) {
        if (gfa[x] >= 0)
            last_nontrivial_index = x;
    }
    gfa = gfa.slice(first_nontrivial_index,last_nontrivial_index);
    let ft_gfa = await dft(gfa);

    let fourier_series = (x) => {
        let y = 0;
        let N = ft_gfa[0].length;
        for (k=0; k < N; k++) {
            let w = 2 * Math.PI * k * x / N;
            y += ft_gfa[0][k] * Math.cos(w) - ft_gfa[1][k] * Math.sin(w);
        }
        return y / N;
    };

    console.log("Painting fourier series");

    ctx.fillStyle = "#F00";
    for (x=0;x <= canvas.width; x++) {
        let y = fourier_series(x);
        ctx.fillRect(x,y,2,2);
    }

    return ft_gfa;
}

/** Take the Fourier transform `ft` as a complex array `[real,imag]` and
 *  play the sound wave corresponding to the spectrum `ft`.
 */
function fourier_series_to_sound(ft) {
    // front end is hell
    // https://stackoverflow.com/questions/7944460/detect-safari-browser
    let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
        AudioContext = webkitAudioContext;
    }
    try {
        let actx = new AudioContext();
        console.log("Trying to create wave now");
        let wave = actx.createPeriodicWave(ft[0],ft[1]);
        console.log("Creating oscillator");
        let o = actx.createOscillator();
        o.setPeriodicWave(wave);
        o.connect(actx.destination);
        o.start();
    } catch (e) {
        alert("Something failed when trying to render audio. Error: \n" + toString(e));
    }
}

async function sample_button_enable(active) {
    let inner_span = document.getElementById("sample_button_caption");
    let loading_circle = document.getElementById("sample_button_spinner");
    if (active) {
        loading_circle.classList.add("visually-hidden");
        inner_span.innerHTML = "Sample Graph";
        button.disabled = false;
    } else {
        loading_circle.classList.remove("visually-hidden");
        inner_span.innerHTML = "Loading...";
        button.disabled = true;
    }
}
