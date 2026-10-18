## Getting Started

This document is intended to get you started quickly in building a backend driven Node.js application complete with pages and content, backend logic and a PostgreSQL database for data storage.
## Prerequisites

The only prerequisite software required to have installed at this point is Git for version control and a code editor - we will use VS Code (VSC).

## Package Management

The foundation of the project development software is Node. While functional, Node depends on "packages" to add functionality to accomplish common tasks. This requires a package manager. Three common managers are NPM (Node Package Manager), YARN, and PNPM. While all do the same thing, they do it slightly differently. We will use PNPM for two reasons: 1) All packages are stored on your computer only once and then symlinks (system links) are created from the package to the project as needed, 2) performance is increased meaning that when the project builds, it does so faster.
You will need to either install or activate PNPM before using it. See https://pnpm.io/

## Install the Project Dependencies

1. Open the downloaded project folder (where this file is located) in VS Code (VSC).
2. Open the VSC terminal: Terminal > New Window.
3. Run the following command in the terminal:

    pnpm install

4. The first time it may take a few minutes, depending on the speed of your computer and the speed of your Internet connection. This command will instruct PNPM to read the package.json file and download and install the dependencies (packages) needed for the project. It will build a "node_modules" folder storing each dependency and its dependencies. It should also create a pnpm-lock.yaml file. This file should NEVER be altered by you. It is an internal file (think of it as an inventory) that PNPM uses to keep track of everything in the project.

## Start the Express Server

With the packages installed you're ready to run the initial test.
1. If the VSC terminal is still open use it. If it is closed, open it again using the same command as before.
2. Type the following command, then press Enter:

    pnpm run dev

3. If the command works, you should see the message "app listening on localhost:5500" in the console.
4. Open the package.json file.
5. Note the "Scripts" area? There is a line with the name of "dev", which tells the nodemon package to run the server.js file.
6. This is the command you just ran.
7. Open the server.js file.
8. Near the bottom you'll see two variables "Port" and "Host". The values for the variables are stored in the .env file.
9. These variables are used when the server starts on your local machine.

## Move the demo file

When you installed Git and cloned the remote repository in week 1, you should have created a simple web page.
1. Find and move that simple web page to the public folder. Be sure to note its name.
## Test in a browser

1. Go to http://localhost:5500 in a browser tab. Nothing should be visible as the server has not been setup to repond to that route.
2. Add "/filename.html" to the end of the URL (replacing filename with the name of the file you moved to the public folder).
3. You should see that page in the browser.

## Finanzas (app minimalista)

App para registrar gastos e ingresos en segundos. Vive en `public/finanzas/`.

- **Abrir:** con el servidor corriendo (`pnpm run dev`) entra a http://localhost:5500/finanzas/ — o abre `public/finanzas/index.html` directamente en el navegador.
- **Registrar:** escribe el monto (se abre el teclado numérico) y toca la categoría: listo, queda guardado.
  - La nota es opcional; "Hoy" cambia la fecha.
  - Las categorías marcadas en verde son de ingreso.
- **Editar:** toca un movimiento para cambiar monto, nota, categoría o fecha, o para eliminarlo.
- **Categorías (⚙):** cambia ícono y nombre, añade o borra, y marca cada una como gasto o ingreso.
- **Ver:** balance del mes, en qué se va el dinero y la lista de movimientos. Usa ‹ › para otros meses.
- **Presupuesto (opcional, ⚙):** te dice cuánto te queda y cuánto puedes gastar por día.
- **Datos:** se guardan en tu navegador. Desde ⚙ puedes exportar a CSV (Excel) o hacer/restaurar una copia de seguridad.
- **En el celular:** ábrela y elige "Agregar a pantalla de inicio" para usarla como app, también sin conexión.
