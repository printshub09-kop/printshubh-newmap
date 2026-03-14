const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve all static files from /public folder
app.use(express.static(path.join(__dirname, 'public')));

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('PrintsHubh running on port ' + PORT);
});
});

app.listen(PORT, () => {
  console.log('✅ PrintsHubh server running on port ' + PORT);
});
