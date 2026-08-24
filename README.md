# Running the Project

This project uses JavaScript ES Modules (`.mjs`).

## Requirements

- Python 3

## Run the Project

1. Open a terminal in the project folder.

2. Start the local web server:
```bash
python -m http.server 8000
```

3. Open your browser and go to:
```
http://localhost:8000
```
4. The `index.html` file will be loaded automatically.

## Important

Do not open `index.html` directly using:

```
file:///...
```

The project uses ES Modules (`.mjs), which require the files to be served through a local web server.

## Stop the Server

To stop the server, press:

```
Ctrl + C
```