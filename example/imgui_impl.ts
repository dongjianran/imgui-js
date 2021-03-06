import * as ImGui from "../imgui";

export let gl: WebGLRenderingContext | null = null;
let g_ShaderHandle: WebGLProgram | null = null;
let g_VertHandle: WebGLShader | null = null;
let g_FragHandle: WebGLShader | null = null;
let g_AttribLocationTex: WebGLUniformLocation | null = null;
let g_AttribLocationProjMtx: WebGLUniformLocation | null = null;
let g_AttribLocationPosition: GLint = -1;
let g_AttribLocationUV: GLint = -1;
let g_AttribLocationColor: GLint = -1;
let g_VboHandle: WebGLBuffer | null = null;
let g_ElementsHandle: WebGLBuffer | null = null;
let g_FontTexture: WebGLTexture | null = null;

let prev_time: number = 0;

export function Init(value: HTMLCanvasElement | WebGLRenderingContext | null): void {
    if (value && value instanceof(HTMLCanvasElement)) {
        gl = value.getContext("webgl", { alpha: false });
    } else if (value && value instanceof(WebGLRenderingContext)) {
        gl = value;
    }

    const io = ImGui.GetIO();

    if (typeof(navigator) !== "undefined") {
        io.OptMacOSXBehaviors = navigator.platform.match(/Mac/) !== null;
    }

    if (gl !== null) {
        const canvas: HTMLCanvasElement = gl.canvas;

        canvas.addEventListener("blur", (event: FocusEvent): void => {
            const io = ImGui.GetIO();
            io.KeyCtrl = false;
            io.KeyShift = false;
            io.KeyAlt = false;
            io.KeySuper = false;
            for (let i = 0; i < io.KeysDown.length; ++i) {
                io.KeysDown[i] = false;
            }
            for (let i = 0; i < io.MouseDown.length; ++i) {
                io.MouseDown[i] = false;
            }
        });

        canvas.addEventListener("keydown", (event: KeyboardEvent): void => {
            console.log(event.type, event.key, event.keyCode);
            const io = ImGui.GetIO();
            io.KeyCtrl = event.ctrlKey;
            io.KeyShift = event.shiftKey;
            io.KeyAlt = event.altKey;
            io.KeySuper = event.metaKey;
            ImGui.IM_ASSERT(event.keyCode >= 0 && event.keyCode < ImGui.IM_ARRAYSIZE(io.KeysDown));
            io.KeysDown[event.keyCode] = true;
            // forward to the keypress event
            if (/*io.WantCaptureKeyboard ||*/ event.key === "Tab") {
                event.preventDefault();
            }
        });

        canvas.addEventListener("keyup", (event: KeyboardEvent): void => {
            console.log(event.type, event.key, event.keyCode);
            const io = ImGui.GetIO();
            io.KeyCtrl = event.ctrlKey;
            io.KeyShift = event.shiftKey;
            io.KeyAlt = event.altKey;
            io.KeySuper = event.metaKey;
            ImGui.IM_ASSERT(event.keyCode >= 0 && event.keyCode < ImGui.IM_ARRAYSIZE(io.KeysDown));
            io.KeysDown[event.keyCode] = false;
            if (io.WantCaptureKeyboard) {
                event.preventDefault();
            }
        });

        canvas.addEventListener("keypress", (event: KeyboardEvent): void => {
            console.log(event.type, event.key, event.keyCode);
            const io = ImGui.GetIO();
            io.AddInputCharacter(event.charCode);
            if (io.WantCaptureKeyboard) {
                event.preventDefault();
            }
        });

        canvas.style.touchAction = "none"; // Disable browser handling of all panning and zooming gestures.

        canvas.addEventListener("pointermove", (event: PointerEvent): void => {
            const io = ImGui.GetIO();
            io.MousePos.x = event.offsetX;
            io.MousePos.y = event.offsetY;
            if (io.WantCaptureMouse) {
                event.preventDefault();
            }
        });

        // MouseEvent.button
        // A number representing a given button:
        // 0: Main button pressed, usually the left button or the un-initialized state
        // 1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
        // 2: Secondary button pressed, usually the right button
        // 3: Fourth button, typically the Browser Back button
        // 4: Fifth button, typically the Browser Forward button
        const mouse_button_map: number[] = [ 0, 2, 1, 3, 4 ];

        canvas.addEventListener("pointerdown", (event: PointerEvent): void => {
            const io = ImGui.GetIO();
            io.MousePos.x = event.offsetX;
            io.MousePos.y = event.offsetY;
            io.MouseDown[mouse_button_map[event.button]] = true;
            // if (io.WantCaptureMouse) {
            //     event.preventDefault();
            // }
        });
        canvas.addEventListener("contextmenu", (event: PointerEvent): void => {
            if (io.WantCaptureMouse) {
                event.preventDefault();
            }
        });

        canvas.addEventListener("pointerup", (event: PointerEvent): void => {
            const io = ImGui.GetIO();
            io.MouseDown[mouse_button_map[event.button]] = false;
            if (io.WantCaptureMouse) {
                event.preventDefault();
            }
        });

        canvas.addEventListener("wheel", (event: WheelEvent): void => {
            const io = ImGui.GetIO();
            let scale: number = 1.0;
            switch (event.deltaMode) {
                case event.DOM_DELTA_PIXEL: scale = 0.01; break;
                case event.DOM_DELTA_LINE: scale = 0.2; break;
                case event.DOM_DELTA_PAGE: scale = 1.0; break;
            }
            io.MouseWheelH = event.deltaX * scale;
            io.MouseWheel = -event.deltaY * scale; // Mouse wheel: 1 unit scrolls about 5 lines text.
            if (io.WantCaptureMouse) {
                event.preventDefault();
            }
        });

        let clipboard_text: string = "";

        // io.SetClipboardTextFn = ImGui_Impl_SetClipboardText;
        io.SetClipboardTextFn = (user_data: any, text: string): void => {
            // TODO: write to system clipboard
            clipboard_text = text;
            console.log("set system clipboard", clipboard_text);
        };
        // io.GetClipboardTextFn = ImGui_Impl_GetClipboardText;
        io.GetClipboardTextFn = (user_data: any): string => {
            // TODO: read from system clipboard
            console.log("get system clipboard", clipboard_text);
            return clipboard_text;
        };
        // io.ClipboardUserData = NULL;
        io.ClipboardUserData = null;

        document.body.addEventListener("copy", (event: ClipboardEvent): void => {
            const data: string = event.clipboardData.getData("text/plain");
            console.log(event.type, clipboard_text, data);
            event.preventDefault();
        });

        document.body.addEventListener("cut", (event: ClipboardEvent): void => {
            const data: string = event.clipboardData.getData("text/plain");
            console.log(event.type, clipboard_text, data);
            event.preventDefault();
        });

        document.body.addEventListener("paste", (event: ClipboardEvent): void => {
            const data: string = event.clipboardData.getData("text/plain");
            console.log(event.type, clipboard_text, data);
            event.preventDefault();
        });
    }

    // Setup back-end capabilities flags
    io.BackendFlags |= ImGui.BackendFlags.HasMouseCursors;   // We can honor GetMouseCursor() values (optional)

    // Keyboard mapping. ImGui will use those indices to peek into the io.KeyDown[] array.
    io.KeyMap[ImGui.Key.Tab] = 9;
    io.KeyMap[ImGui.Key.LeftArrow] = 37;
    io.KeyMap[ImGui.Key.RightArrow] = 39;
    io.KeyMap[ImGui.Key.UpArrow] = 38;
    io.KeyMap[ImGui.Key.DownArrow] = 40;
    io.KeyMap[ImGui.Key.PageUp] = 33;
    io.KeyMap[ImGui.Key.PageDown] = 34;
    io.KeyMap[ImGui.Key.Home] = 36;
    io.KeyMap[ImGui.Key.End] = 35;
    io.KeyMap[ImGui.Key.Insert] = 45;
    io.KeyMap[ImGui.Key.Delete] = 46;
    io.KeyMap[ImGui.Key.Backspace] = 8;
    io.KeyMap[ImGui.Key.Space] = 32;
    io.KeyMap[ImGui.Key.Enter] = 13;
    io.KeyMap[ImGui.Key.Escape] = 27;
    io.KeyMap[ImGui.Key.A] = 65;
    io.KeyMap[ImGui.Key.C] = 67;
    io.KeyMap[ImGui.Key.V] = 86;
    io.KeyMap[ImGui.Key.X] = 88;
    io.KeyMap[ImGui.Key.Y] = 89;
    io.KeyMap[ImGui.Key.Z] = 90;

    // Backup GL state
    const last_texture: WebGLTexture | null = gl && gl.getParameter(gl.TEXTURE_BINDING_2D);
    const last_array_buffer: WebGLBuffer | null = gl && gl.getParameter(gl.ARRAY_BUFFER_BINDING);

    const vertex_shader: string[] = [
        "uniform mat4 ProjMtx;",
        "attribute vec2 Position;",
        "attribute vec2 UV;",
        "attribute vec4 Color;",
        "varying vec2 Frag_UV;",
        "varying vec4 Frag_Color;",
        "void main() {",
        "	Frag_UV = UV;",
        "	Frag_Color = Color;",
        "	gl_Position = ProjMtx * vec4(Position.xy,0,1);",
        "}",
    ];

    const fragment_shader: string[] = [
        // #ifdef __EMSCRIPTEN__
        // WebGL requires precision specifiers but OpenGL 2.1 disallows
        // them, so I define the shader without it and then add it here.
        "precision mediump float;",
        // #endif
        "uniform sampler2D Texture;",
        "varying vec2 Frag_UV;",
        "varying vec4 Frag_Color;",
        "void main() {",
        "	gl_FragColor = Frag_Color * texture2D(Texture, Frag_UV);",
        "}",
    ];

    g_ShaderHandle = gl && gl.createProgram();
    g_VertHandle = gl && gl.createShader(gl.VERTEX_SHADER);
    g_FragHandle = gl && gl.createShader(gl.FRAGMENT_SHADER);
    gl && gl.shaderSource(g_VertHandle, vertex_shader.join("\n"));
    gl && gl.shaderSource(g_FragHandle, fragment_shader.join("\n"));
    gl && gl.compileShader(g_VertHandle);
    gl && gl.compileShader(g_FragHandle);
    gl && gl.attachShader(g_ShaderHandle, g_VertHandle);
    gl && gl.attachShader(g_ShaderHandle, g_FragHandle);
    gl && gl.linkProgram(g_ShaderHandle);

    g_AttribLocationTex = gl && gl.getUniformLocation(g_ShaderHandle, "Texture");
    g_AttribLocationProjMtx = gl && gl.getUniformLocation(g_ShaderHandle, "ProjMtx");
    g_AttribLocationPosition = gl && gl.getAttribLocation(g_ShaderHandle, "Position") || 0;
    g_AttribLocationUV = gl && gl.getAttribLocation(g_ShaderHandle, "UV") || 0;
    g_AttribLocationColor = gl && gl.getAttribLocation(g_ShaderHandle, "Color") || 0;

    g_VboHandle = gl && gl.createBuffer();
    g_ElementsHandle = gl && gl.createBuffer();

    // Build texture
    // const width: number = 256;
    // const height: number = 256;
    // const pixels: Uint8Array = new Uint8Array(4 * width * height).fill(0xff);
    const { width, height, pixels } = io.Fonts.GetTexDataAsRGBA32();   // Load as RGBA 32-bits for OpenGL3 demo because it is more likely to be compatible with user's existing shader.
    // console.log(`font texture ${width} x ${height} @ ${pixels.length}`);

    // Create OpenGL texture
    g_FontTexture = gl && gl.createTexture();
    gl && gl.bindTexture(gl.TEXTURE_2D, g_FontTexture);
    gl && gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl && gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl && gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Store our identifier
    io.Fonts.TexID = g_FontTexture || { foo: "bar" };
    // console.log("font texture id", g_FontTexture);

    // Cleanup (don't clear the input data if you want to append new fonts later)
    // io.Fonts.ClearInputData();
    // io.Fonts.ClearTexData();

    // Restore modified GL state
    gl && last_texture && gl.bindTexture(gl.TEXTURE_2D, last_texture);
    gl && last_array_buffer && gl.bindBuffer(gl.ARRAY_BUFFER, last_array_buffer);
}

export function Shutdown(): void {
    const io = ImGui.GetIO();

    io.Fonts.TexID = null;
    gl && gl.deleteTexture(g_FontTexture); g_FontTexture = null;

    gl && gl.deleteBuffer(g_VboHandle); g_VboHandle = null;
    gl && gl.deleteBuffer(g_ElementsHandle); g_ElementsHandle = null;

    g_AttribLocationTex = null;
    g_AttribLocationProjMtx = null;
    g_AttribLocationPosition = -1;
    g_AttribLocationUV = -1;
    g_AttribLocationColor = -1;

    gl && gl.deleteProgram(g_ShaderHandle); g_ShaderHandle = null;
    gl && gl.deleteShader(g_VertHandle); g_VertHandle = null;
    gl && gl.deleteShader(g_FragHandle); g_FragHandle = null;
}

export function NewFrame(time: number): void {
    const io = ImGui.GetIO();

    const w: number = gl && gl.canvas.scrollWidth || 640;
    const h: number = gl && gl.canvas.scrollHeight || 480;
    const display_w: number = gl && gl.drawingBufferWidth || w;
    const display_h: number = gl && gl.drawingBufferHeight || h;
    io.DisplaySize.x = w;
    io.DisplaySize.y = h;
    io.DisplayFramebufferScale.x = w > 0 ? (display_w / w) : 0;
    io.DisplayFramebufferScale.y = h > 0 ? (display_h / h) : 0;

    const dt: number = time - prev_time;
    prev_time = time;
    io.DeltaTime = dt / 1000;

    if (io.WantSetMousePos) {
        console.log("TODO: MousePos", io.MousePos.x, io.MousePos.y);
    }

    if (typeof(document) !== "undefined") {
        if (io.MouseDrawCursor) {
            document.body.style.cursor = "none";
        } else {
            switch (ImGui.GetMouseCursor()) {
                case ImGui.MouseCursor.None: document.body.style.cursor = "none"; break;
                default: case ImGui.MouseCursor.Arrow: document.body.style.cursor = "default"; break;
                case ImGui.MouseCursor.TextInput: document.body.style.cursor = "text"; break;         // When hovering over InputText, etc.
                case ImGui.MouseCursor.ResizeAll: document.body.style.cursor = "move"; break;         // Unused
                case ImGui.MouseCursor.ResizeNS: document.body.style.cursor = "ns-resize"; break;     // When hovering over an horizontal border
                case ImGui.MouseCursor.ResizeEW: document.body.style.cursor = "ew-resize"; break;     // When hovering over a vertical border or a column
                case ImGui.MouseCursor.ResizeNESW: document.body.style.cursor = "nesw-resize"; break; // When hovering over the bottom-left corner of a window
                case ImGui.MouseCursor.ResizeNWSE: document.body.style.cursor = "nwse-resize"; break; // When hovering over the bottom-right corner of a window
            }
        }
    }

    // Gamepad navigation mapping [BETA]
    for (let i = 0; i < io.NavInputs.length; ++i) {
        io.NavInputs[i] = 0.0;
    }
    if (io.ConfigFlags & ImGui.ConfigFlags.NavEnableGamepad) {
        // Update gamepad inputs
        const gamepads: (Gamepad | null)[] = (typeof(navigator) !== "undefined" && typeof(navigator.getGamepads) === "function") ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; ++i) {
            const gamepad: Gamepad | null = gamepads[i];
            if (!gamepad) { continue; }
            const buttons_count: number = gamepad.buttons.length;
            const axes_count: number = gamepad.axes.length;
            function MAP_BUTTON(NAV_NO: number, BUTTON_NO: number): void {
                if (!gamepad) { return; }
                if (buttons_count > BUTTON_NO && gamepad.buttons[BUTTON_NO].pressed)
                    io.NavInputs[NAV_NO] = 1.0;
            }
            function MAP_ANALOG(NAV_NO: number, AXIS_NO: number, V0: number, V1: number): void {
                if (!gamepad) { return; }
                let v: number = (axes_count > AXIS_NO) ? gamepad.axes[AXIS_NO] : V0;
                v = (v - V0) / (V1 - V0);
                if (v > 1.0) v = 1.0;
                if (io.NavInputs[NAV_NO] < v) io.NavInputs[NAV_NO] = v;
            }
            // TODO: map input based on vendor and product id
            // https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/id
            const match: RegExpMatchArray | null = gamepad.id.match(/^([0-9a-f]{4})-([0-9a-f]{4})-.*$/);
            const match_chrome: RegExpMatchArray | null = gamepad.id.match(/^.*\(.*Vendor: ([0-9a-f]{4}) Product: ([0-9a-f]{4})\).*$/);
            const vendor: string = (match && match[1]) || (match_chrome && match_chrome[1]) || "0000";
            const product: string = (match && match[2]) || (match_chrome && match_chrome[2]) || "0000";
            switch (vendor + product) {
                case "046dc216": // Logitech Logitech Dual Action (Vendor: 046d Product: c216)
                MAP_BUTTON(ImGui.NavInput.Activate,    1); // Cross / A
                MAP_BUTTON(ImGui.NavInput.Cancel,      2); // Circle / B
                MAP_BUTTON(ImGui.NavInput.Menu,        0); // Square / X
                MAP_BUTTON(ImGui.NavInput.Input,       3); // Triangle / Y
                MAP_ANALOG(ImGui.NavInput.DpadLeft,    4, -0.3, -0.9); // D-Pad Left
                MAP_ANALOG(ImGui.NavInput.DpadRight,   4, +0.3, +0.9); // D-Pad Right
                MAP_ANALOG(ImGui.NavInput.DpadUp,      5, -0.3, -0.9); // D-Pad Up
                MAP_ANALOG(ImGui.NavInput.DpadDown,    5, +0.3, +0.9); // D-Pad Down
                MAP_BUTTON(ImGui.NavInput.FocusPrev,   4); // L1 / LB
                MAP_BUTTON(ImGui.NavInput.FocusNext,   5); // R1 / RB
                MAP_BUTTON(ImGui.NavInput.TweakSlow,   6); // L2 / LT
                MAP_BUTTON(ImGui.NavInput.TweakFast,   7); // R2 / RT
                MAP_ANALOG(ImGui.NavInput.LStickLeft,  0, -0.3, -0.9);
                MAP_ANALOG(ImGui.NavInput.LStickRight, 0, +0.3, +0.9);
                MAP_ANALOG(ImGui.NavInput.LStickUp,    1, -0.3, -0.9);
                MAP_ANALOG(ImGui.NavInput.LStickDown,  1, +0.3, +0.9);
                break;
                case "046dc21d": // Logitech Gamepad F310 (STANDARD GAMEPAD Vendor: 046d Product: c21d)
                MAP_BUTTON(ImGui.NavInput.Activate,    0); // Cross / A
                MAP_BUTTON(ImGui.NavInput.Cancel,      1); // Circle / B
                MAP_BUTTON(ImGui.NavInput.Menu,        2); // Square / X
                MAP_BUTTON(ImGui.NavInput.Input,       3); // Triangle / Y
                MAP_BUTTON(ImGui.NavInput.DpadLeft,    14); // D-Pad Left
                MAP_BUTTON(ImGui.NavInput.DpadRight,   15); // D-Pad Right
                MAP_BUTTON(ImGui.NavInput.DpadUp,      12); // D-Pad Up
                MAP_BUTTON(ImGui.NavInput.DpadDown,    13); // D-Pad Down
                MAP_BUTTON(ImGui.NavInput.FocusPrev,   4); // L1 / LB
                MAP_BUTTON(ImGui.NavInput.FocusNext,   5); // R1 / RB
                MAP_ANALOG(ImGui.NavInput.TweakSlow,   6, +0.3, +0.9); // L2 / LT
                MAP_ANALOG(ImGui.NavInput.TweakFast,   7, +0.3, +0.9); // R2 / RT
                MAP_ANALOG(ImGui.NavInput.LStickLeft,  0, -0.3, -0.9);
                MAP_ANALOG(ImGui.NavInput.LStickRight, 0, +0.3, +0.9);
                MAP_ANALOG(ImGui.NavInput.LStickUp,    1, -0.3, -0.9);
                MAP_ANALOG(ImGui.NavInput.LStickDown,  1, +0.3, +0.9);
                break;
                case "2dc86001": // 8Bitdo SN30 Pro  8Bitdo SN30 Pro (Vendor: 2dc8 Product: 6001)
                case "2dc86101": // 8Bitdo SN30 Pro (Vendor: 2dc8 Product: 6101)
                MAP_BUTTON(ImGui.NavInput.Activate,    1); // Cross / A
                MAP_BUTTON(ImGui.NavInput.Cancel,      0); // Circle / B
                MAP_BUTTON(ImGui.NavInput.Menu,        4); // Square / X
                MAP_BUTTON(ImGui.NavInput.Input,       3); // Triangle / Y
                MAP_ANALOG(ImGui.NavInput.DpadLeft,    6, -0.3, -0.9); // D-Pad Left
                MAP_ANALOG(ImGui.NavInput.DpadRight,   6, +0.3, +0.9); // D-Pad Right
                MAP_ANALOG(ImGui.NavInput.DpadUp,      7, -0.3, -0.9); // D-Pad Up
                MAP_ANALOG(ImGui.NavInput.DpadDown,    7, +0.3, +0.9); // D-Pad Down
                MAP_BUTTON(ImGui.NavInput.FocusPrev,   6); // L1 / LB
                MAP_BUTTON(ImGui.NavInput.FocusNext,   7); // R1 / RB
                MAP_BUTTON(ImGui.NavInput.TweakSlow,   8); // L2 / LT
                MAP_BUTTON(ImGui.NavInput.TweakFast,   9); // R2 / RT
                MAP_ANALOG(ImGui.NavInput.LStickLeft,  0, -0.3, -0.9);
                MAP_ANALOG(ImGui.NavInput.LStickRight, 0, +0.3, +0.9);
                MAP_ANALOG(ImGui.NavInput.LStickUp,    1, -0.3, -0.9);
                MAP_ANALOG(ImGui.NavInput.LStickDown,  1, +0.3, +0.9);
                break;
                default: // standard gamepad: https://w3c.github.io/gamepad/#remapping
                MAP_BUTTON(ImGui.NavInput.Activate,    0); // Cross / A
                MAP_BUTTON(ImGui.NavInput.Cancel,      1); // Circle / B
                MAP_BUTTON(ImGui.NavInput.Menu,        2); // Square / X
                MAP_BUTTON(ImGui.NavInput.Input,       3); // Triangle / Y
                MAP_BUTTON(ImGui.NavInput.DpadLeft,    14); // D-Pad Left
                MAP_BUTTON(ImGui.NavInput.DpadRight,   15); // D-Pad Right
                MAP_BUTTON(ImGui.NavInput.DpadUp,      12); // D-Pad Up
                MAP_BUTTON(ImGui.NavInput.DpadDown,    13); // D-Pad Down
                MAP_BUTTON(ImGui.NavInput.FocusPrev,   4); // L1 / LB
                MAP_BUTTON(ImGui.NavInput.FocusNext,   5); // R1 / RB
                MAP_BUTTON(ImGui.NavInput.TweakSlow,   6); // L2 / LT
                MAP_BUTTON(ImGui.NavInput.TweakFast,   7); // R2 / RT
                MAP_ANALOG(ImGui.NavInput.LStickLeft,  0, -0.3, -0.9);
                MAP_ANALOG(ImGui.NavInput.LStickRight, 0, +0.3, +0.9);
                MAP_ANALOG(ImGui.NavInput.LStickUp,    1, -0.3, -0.9);
                MAP_ANALOG(ImGui.NavInput.LStickDown,  1, +0.3, +0.9);
                break;
            }
        }
    }
}

export function RenderDrawData(draw_data: ImGui.ImDrawData | null = ImGui.GetDrawData()): void {
    const io = ImGui.GetIO();
    if (draw_data === null) { throw new Error(); }

    gl || console.log(draw_data);

    // Avoid rendering when minimized, scale coordinates for retina displays (screen coordinates != framebuffer coordinates)
    const fb_width: number = io.DisplaySize.x * io.DisplayFramebufferScale.x;
    const fb_height: number = io.DisplaySize.y * io.DisplayFramebufferScale.y;
    if (fb_width === 0 || fb_height === 0) {
        return;
    }
    draw_data.ScaleClipRects(io.DisplayFramebufferScale);

    // Backup GL state
    const last_program: WebGLProgram | null = gl && gl.getParameter(gl.CURRENT_PROGRAM) || null;
    const last_texture: WebGLTexture | null = gl && gl.getParameter(gl.TEXTURE_BINDING_2D) || null;
    const last_array_buffer: WebGLBuffer | null = gl && gl.getParameter(gl.ARRAY_BUFFER_BINDING) || null;
    const last_element_array_buffer: WebGLBuffer | null = gl && gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) || null;

    // Setup render state: alpha-blending enabled, no face culling, no depth testing, scissor enabled
    gl && gl.enable(gl.BLEND);
    gl && gl.blendEquation(gl.FUNC_ADD);
    gl && gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl && gl.disable(gl.CULL_FACE);
    gl && gl.disable(gl.DEPTH_TEST);
    gl && gl.enable(gl.SCISSOR_TEST);
    gl && gl.activeTexture(gl.TEXTURE0);

    // Setup orthographic projection matrix
    const ortho_projection: Float32Array = new Float32Array([
        2.0 / io.DisplaySize.x, 0.0, 0.0, 0.0,
        0.0, -2.0 / io.DisplaySize.y, 0.0, 0.0,
        0.0, 0.0, -1.0, 0.0,
        -1.0, 1.0, 0.0, 1.0,
    ]);
    gl && gl.useProgram(g_ShaderHandle);
    gl && gl.uniform1i(g_AttribLocationTex, 0);
    gl && g_AttribLocationProjMtx && gl.uniformMatrix4fv(g_AttribLocationProjMtx, false, ortho_projection);

    // Render command lists
    gl && gl.bindBuffer(gl.ARRAY_BUFFER, g_VboHandle);
    gl && gl.enableVertexAttribArray(g_AttribLocationPosition);
    gl && gl.enableVertexAttribArray(g_AttribLocationUV);
    gl && gl.enableVertexAttribArray(g_AttribLocationColor);

    gl && gl.vertexAttribPointer(g_AttribLocationPosition, 2, gl.FLOAT, false, ImGui.ImDrawVertSize, ImGui.ImDrawVertPosOffset);
    gl && gl.vertexAttribPointer(g_AttribLocationUV, 2, gl.FLOAT, false, ImGui.ImDrawVertSize, ImGui.ImDrawVertUVOffset);
    gl && gl.vertexAttribPointer(g_AttribLocationColor, 4, gl.UNSIGNED_BYTE, true, ImGui.ImDrawVertSize, ImGui.ImDrawVertColOffset);

    const ElemType: GLenum = gl && ((ImGui.ImDrawIdxSize === 4) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT) || 0;

    draw_data.IterateDrawLists((draw_list: ImGui.ImDrawList): void => {
        gl || console.log(draw_list);
        gl || console.log("VtxBuffer.length", draw_list.VtxBuffer.length);
        gl || console.log("IdxBuffer.length", draw_list.IdxBuffer.length);

        gl && gl.bindBuffer(gl.ARRAY_BUFFER, g_VboHandle);
        gl && gl.bufferData(gl.ARRAY_BUFFER, draw_list.VtxBuffer, gl.STREAM_DRAW);
        gl && gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g_ElementsHandle);
        gl && gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, draw_list.IdxBuffer, gl.STREAM_DRAW);

        let ElemStart: number = 0;

        draw_list.IterateDrawCmds((draw_cmd: ImGui.ImDrawCmd): void => {
            gl || console.log(draw_cmd);
            gl || console.log("ElemCount", draw_cmd.ElemCount);
            gl || console.log("ClipRect", draw_cmd.ClipRect.x, fb_height - draw_cmd.ClipRect.w, draw_cmd.ClipRect.z - draw_cmd.ClipRect.x, draw_cmd.ClipRect.w - draw_cmd.ClipRect.y);
            gl || console.log("TextureId", draw_cmd.TextureId);
            if (!gl) {
                console.log("i: pos.x pos.y uv.x uv.y col");
                for (let i = 0; i < Math.min(3, draw_cmd.ElemCount); ++i) {
                    const view: ImGui.ImDrawVert = new ImGui.ImDrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i * ImGui.ImDrawVertSize);
                    console.log(`${i}: ${view.pos[0].toFixed(2)} ${view.pos[1].toFixed(2)} ${view.uv[0].toFixed(5)} ${view.uv[1].toFixed(5)} ${("00000000" + view.col[0].toString(16)).substr(-8)}`);
                }
            }

            if (draw_cmd.UserCallback !== null) {
                draw_cmd.UserCallback(draw_list, draw_cmd);
            } else {
                gl && gl.bindTexture(gl.TEXTURE_2D, draw_cmd.TextureId);
                gl && gl.scissor(draw_cmd.ClipRect.x, fb_height - draw_cmd.ClipRect.w, draw_cmd.ClipRect.z - draw_cmd.ClipRect.x, draw_cmd.ClipRect.w - draw_cmd.ClipRect.y);
                gl && gl.drawElements(gl.TRIANGLES, draw_cmd.ElemCount, ElemType, ElemStart * ImGui.ImDrawIdxSize);
            }

            ElemStart += draw_cmd.ElemCount;
        });
    });

    // Restore modified state
    gl && gl.disableVertexAttribArray(g_AttribLocationPosition);
    gl && gl.disableVertexAttribArray(g_AttribLocationUV);
    gl && gl.disableVertexAttribArray(g_AttribLocationColor);
    gl && last_program && gl.useProgram(last_program);
    gl && last_texture && gl.bindTexture(gl.TEXTURE_2D, last_texture);
    gl && last_array_buffer && gl.bindBuffer(gl.ARRAY_BUFFER, last_array_buffer);
    gl && last_element_array_buffer && gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, last_element_array_buffer);
    gl && gl.disable(gl.SCISSOR_TEST);
}
