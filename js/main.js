
(function() {

    const VERTEX_SHADER_SOURCE = `
attribute vec3 position;

void main(void) {
    gl_Position = vec4(position, 1.0);
}
    `;

    const INITIAL_FRAGMENT_SOURCE = `
#ifdef GL_ES
precision mediump float;
#endif

#extension GL_OES_standard_derivatives : enable

uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;

void main( void ) {

    vec2 position = ( gl_FragCoord.xy / resolution.xy ) + mouse / 4.0;

    float color = 0.0;
    color += sin( position.x * cos( time / 15.0 ) * 80.0 ) + cos( position.y * cos( time / 15.0 ) * 10.0 );
    color += sin( position.y * sin( time / 10.0 ) * 40.0 ) + cos( position.x * sin( time / 25.0 ) * 40.0 );
    color += sin( position.x * sin( time / 5.0 ) * 10.0 ) + sin( position.y * sin( time / 35.0 ) * 80.0 );
    color *= sin( time / 10.0 ) * 0.5;

    gl_FragColor = vec4( vec3( color, color * 0.5, sin( color + time / 3.0 ) * 0.75 ), 1.0 );

}
`;

    const VERTICES_POSITIONS = new Float32Array([
        -1.0, -1.0, 0.0,
        1.0, -1.0, 0.0,
        -1.0, 1.0, 0.0,
        1.0, 1.0, 0.0
    ]);

    const VERTICES_INDICES = new Int16Array([
        0, 1, 2,
        3, 2, 1
    ]);

    function createShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
        }
        return program;
    }

    function createVbo(gl, array) {
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        return vbo;
    }

    function createIbo(gl, array) {
        const ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        return ibo;
    }

    function getUniformLocations(gl, program, keys) {
        const locations = {};
        keys.forEach((key) => {
            locations[key] = gl.getUniformLocation(program, key);
        });
        return locations;
    }

    function getFragmentSource() {
        const textArea = document.getElementById('textarea-glsl');
        return textArea.value;
    }

    let canvas;
    let inputWidth, inputHeight;
    let inputFps, inputStart, inputDuration;
    let selectFormat;
    let gl;
    let requestId = null;
    let vertexShader;
    let vbo;
    let ibo;

    function resizeCanvas() {
        const width = parseInt(inputWidth.value);
        const height = parseInt(inputHeight.value);
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
    }

    function initialize() {
        const textArea = document.getElementById('textarea-glsl');
        textArea.value = INITIAL_FRAGMENT_SOURCE;
        inputWidth = document.getElementById('input-width');
        inputHeight = document.getElementById('input-height');
        inputFps = document.getElementById('input-fps');
        inputStart = document.getElementById('input-start');
        inputDuration = document.getElementById('input-duration');
        selectFormat = document.getElementById('select-format');

        canvas = document.getElementById('canvas');
        gl = canvas.getContext('webgl');
        resizeCanvas();

        vertexShader = createShader(gl, VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER);
        vbo = createVbo(gl, VERTICES_POSITIONS);
        ibo = createIbo(gl, VERTICES_INDICES);
    }

    function exportImage() {
        if (requestId != null) {
            cancelAnimationFrame(requestId);
        }

        const fragmentShader = createShader(gl, getFragmentSource(), gl.FRAGMENT_SHADER);
        const program = createProgram(gl, vertexShader, fragmentShader);
        const uniforms = getUniformLocations(gl, program, ['time', 'mouse', 'resolution']);
        const attribPosition = gl.getAttribLocation(program, 'position');

        const fps = parseInt(inputFps.value);
        const capturer = new CCapture({
            format: selectFormat.value,
            framerate: fps,
            verbose: true,
            workersPath: 'js/',
        });

        const frame = 1.0 / fps;
        let ellapsedTime = 0.0;
        const startTime = parseFloat(inputStart.value); 
        const duration = parseFloat(inputDuration.value);
        capturer.start();
        const render = function() {
            gl.useProgram(program);
            gl.uniform1f(uniforms['time'], startTime + ellapsedTime);
            gl.uniform2fv(uniforms['mouse'], [0.0, 0.0]);
            gl.uniform2fv(uniforms['resolution'], [canvas.clientWidth, canvas.clientHeight]);
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
            gl.enableVertexAttribArray(attribPosition);
            gl.vertexAttribPointer(attribPosition, 3, gl.FLOAT, false, 0, 0);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
            gl.flush();
            capturer.capture(canvas);
            ellapsedTime += frame;
            if (ellapsedTime < duration) {
                requestId = requestAnimationFrame(render);
            } else {
                cancelAnimationFrame(requestId);
                capturer.stop();
                capturer.save();
                reset();
            }
        }
        render();
    }

    function reset() {

        const fragmentShader = createShader(gl, getFragmentSource(), gl.FRAGMENT_SHADER);
        const program = createProgram(gl, vertexShader, fragmentShader);
        const uniforms = getUniformLocations(gl, program, ['time', 'mouse', 'resolution']);
        const attribPosition = gl.getAttribLocation(program, 'position');

        let startTime = performance.now();
        const render = function() {
            gl.useProgram(program);
            gl.uniform1f(uniforms['time'], 0.001 * (performance.now() - startTime));
            gl.uniform2fv(uniforms['mouse'], [0.0, 0.0]);
            gl.uniform2fv(uniforms['resolution'], [canvas.clientWidth, canvas.clientHeight]);
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
            gl.enableVertexAttribArray(attribPosition);
            gl.vertexAttribPointer(attribPosition, 3, gl.FLOAT, false, 0, 0);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
            gl.flush();
            requestId = requestAnimationFrame(render);
        }
        render();
    }

    document.addEventListener('DOMContentLoaded', () => {

        initialize();

        const buttonUpdate = document.getElementById('button-update');
        buttonUpdate.addEventListener('click', () => {
            if(requestId != null) {
                cancelAnimationFrame(requestId);
            } 
            reset();
        });

        const buttonResize = document.getElementById('button-resize');
        buttonResize.addEventListener('click', () => {
            resizeCanvas();
        });

        const buttonExport = document.getElementById('button-export');
        buttonExport.addEventListener('click', () => {
            exportImage();
        });

        reset();
    });
}());
