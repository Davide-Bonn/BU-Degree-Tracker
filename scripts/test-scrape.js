const https = require('https');
https.get('https://www.bu.edu/academics/cas/courses/computer-science/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Count courses on first page
    const courseLinks = data.match(/href="\/academics\/cas\/courses\/cas-cs-[^"]+"/g) || [];
    console.log('Course links on page 1:', courseLinks.length);
    courseLinks.forEach(l => console.log(' ', l));

    // Look for pagination
    const pageLinks = data.match(/href="[^"]*computer-science\/?\?page=[^"]+"/g) || [];
    console.log('\nPagination links:', pageLinks);

    // Look for "next page" or any pagination wrapper
    const navIdx = data.indexOf('class="pag');
    if (navIdx >= 0) console.log('Pagination class found at:', navIdx);

    // Check all links with "page" in them
    const allPageLinks = data.match(/href="[^"]*page[^"]*"/g) || [];
    console.log('\nAll page links:', allPageLinks.slice(0, 10));
  });
});
