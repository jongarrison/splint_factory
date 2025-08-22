

Things to prove:
* From the electron interface, have a button that can initiate some fetch and display of data about the printer.


Features still needed:
* The electron.js page will be more oriented towards viewing the 3D print queue and initiating a print
* The logged in browser view page will allow selecting a type of splint and then inputing the needed parameters of that splint. Each type of defined splint will have its own page with a form for collecting the needed inputs.
* There needs to be a good way to store the information needed to connect to the printer API. Temporarily, storing that information on the electron.js computer might be fine. Later, there should be organizations that the users are associated with. Organization management should be done by an admin user.  The printer information will be stored with the organization and available to the users.