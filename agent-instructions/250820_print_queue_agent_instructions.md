Initial prompt for creating this file:

Can you help me create an agent instructions file written in plain english for a subset of functionality around a 3D print queue? I imagine there to be an input queue (json parameter data, collected via webforms) and an output queue (both stl and gcode file for the same geometry) which are ready to print.

Some additional notes to describe in the agent instructions:
- There will be a number of webforms for collecting the input parameters. Each webform will be for a named geometry algorithm. Behind the scenes the named geometry algorithm will correspond to a specific Rhino 3d / Grasshopper file to be run
- There will be a webform that allows editing the output queue manually. Initially this form will be used to test the queue functionality.
- Users will only be able to interact with the input queues and output queues that they've created.