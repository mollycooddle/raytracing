using System;
class Program
{
    static void Main()
    {
        using (var window = new View(800, 600))
        {
            window.Run();
        }
    }
}