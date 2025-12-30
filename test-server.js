import('./server.js').catch(err => {
    console.error('=== FULL ERROR ===');
    console.error(err);
    console.error('=== STACK TRACE ===');
    console.error(err.stack);
    process.exit(1);
});
