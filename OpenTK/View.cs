using OpenTK;
using OpenTK.Graphics;
using OpenTK.Graphics.OpenGL;
using OpenTK.Mathematics;
using OpenTK.Windowing.Common;
using OpenTK.Windowing.Desktop;
using System;
using System.IO;

public class View : GameWindow
{
    private int BasicProgramID;
    private int vao;
    private int vbo;

    public View(int width, int height)
        : base(GameWindowSettings.Default,
              new NativeWindowSettings()
              {
                  ClientSize = new Vector2i(width, height),
                  Title = "Raytracing Gradient"
              })
    {
    }

    protected override void OnLoad()
    {
        base.OnLoad();
        InitializeShaders();
        InitializeBuffers();
    }

    private void InitializeShaders()
    {
        string vertShaderSource = File.ReadAllText("..\\..\\..\\Shaders\\raytracing.vert");
        string fragShaderSource = File.ReadAllText("..\\..\\..\\Shaders\\raytracing.frag");

        int vertShader = GL.CreateShader(ShaderType.VertexShader);
        GL.ShaderSource(vertShader, vertShaderSource);
        GL.CompileShader(vertShader);
        CheckShaderError(vertShader, "Vertex");

        int fragShader = GL.CreateShader(ShaderType.FragmentShader);
        GL.ShaderSource(fragShader, fragShaderSource);
        GL.CompileShader(fragShader);
        CheckShaderError(fragShader, "Fragment");

        BasicProgramID = GL.CreateProgram();
        GL.AttachShader(BasicProgramID, vertShader);
        GL.AttachShader(BasicProgramID, fragShader);
        GL.LinkProgram(BasicProgramID);
        CheckProgramError();

        GL.DeleteShader(vertShader);
        GL.DeleteShader(fragShader);
    }

    private void CheckShaderError(int shader, string type)
    {
        string log = GL.GetShaderInfoLog(shader);
        if (!string.IsNullOrEmpty(log))
            Console.WriteLine($"{type} Shader Error: {log}");
    }

    private void CheckProgramError()
    {
        string log = GL.GetProgramInfoLog(BasicProgramID);
        if (!string.IsNullOrEmpty(log))
            Console.WriteLine($"Program Error: {log}");
    }

    private void InitializeBuffers()
    {
        float[] vertices = {
            -1.0f, -1.0f, 0.0f,
             1.0f, -1.0f, 0.0f,
            -1.0f,  1.0f, 0.0f,
             1.0f,  1.0f, 0.0f
        };

        vao = GL.GenVertexArray();
        GL.BindVertexArray(vao);

        vbo = GL.GenBuffer();
        GL.BindBuffer(BufferTarget.ArrayBuffer, vbo);
        GL.BufferData(BufferTarget.ArrayBuffer, vertices.Length * sizeof(float), vertices, BufferUsageHint.StaticDraw);

        GL.VertexAttribPointer(0, 3, VertexAttribPointerType.Float, false, 3 * sizeof(float), 0);
        GL.EnableVertexAttribArray(0);

        GL.BindVertexArray(0);
    }

    protected override void OnRenderFrame(FrameEventArgs e)
    {
        base.OnRenderFrame(e);
        GL.ClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        GL.Clear(ClearBufferMask.ColorBufferBit);

        GL.UseProgram(BasicProgramID);
        GL.BindVertexArray(vao);
        GL.DrawArrays(PrimitiveType.TriangleStrip, 0, 4);

        SwapBuffers();
    }
}
