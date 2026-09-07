const fs = require('fs');

async function fetchAllSlugsForTerm(key, termId) {
  const slugs = [];
  let page = 1;
  while (true) {
    const payload = {
      'template': 'templates/partials/search_results_card_small',
      'cardType': 'card_small',
      'rowType': 'row_regular_v2',
      'params[page]': String(page),
      'params[limit]': '50',
      'params[sortBy]': 'most-relevant',
      'map': '0',
      'locationFieldId': '0',
      'filters[0][key]': key,
      'filters[0][values][0]': String(termId),
      'filters[0][type]': 'taxonomy'
    };
    const body = new URLSearchParams(payload).toString();
    let data = null;
    for (let retry = 0; retry < 3; retry++) {
      try {
        const res = await fetch('https://moithue.com/wp-json/listivo/v1/listings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0'
          },
          body: body,
          signal: AbortSignal.timeout(15000)
        });
        data = await res.json();
        break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    if (!data || !data.template) break;
    const hrefs = data.template.match(/href="https:\/\/moithue\.com\/listing\/([^/?#"]+)\/?"/gi) || [];
    let added = 0;
    for (const h of hrefs) {
      const m = h.match(/\/listing\/([^/?#"]+)/);
      if (m && !slugs.includes(m[1])) {
        slugs.push(m[1]);
        added++;
      }
    }
    if (added === 0 || slugs.length >= data.count) break;
    page++;
  }
  return slugs;
}

async function main() {
  console.log('Fetching official attributes from Moithue...');

  console.log('1. Fetching Pet Allowed (876)...');
  const petAllowedSlugs = await fetchAllSlugsForTerm('listivo_9133', 876);
  console.log(`   Found ${petAllowedSlugs.length} rooms`);

  console.log('2. Fetching Pet Forbidden (877)...');
  const petForbiddenSlugs = await fetchAllSlugsForTerm('listivo_9133', 877);
  console.log(`   Found ${petForbiddenSlugs.length} rooms`);

  console.log('3. Fetching EV Allowed (878)...');
  const evAllowedSlugs = await fetchAllSlugsForTerm('listivo_9166', 878);
  console.log(`   Found ${evAllowedSlugs.length} rooms`);

  console.log('4. Fetching EV Forbidden (879)...');
  const evForbiddenSlugs = await fetchAllSlugsForTerm('listivo_9166', 879);
  console.log(`   Found ${evForbiddenSlugs.length} rooms`);

  console.log('5. Fetching EV VinFast Only (2200)...');
  const evVinFastSlugs = await fetchAllSlugsForTerm('listivo_9166', 2200);
  console.log(`   Found ${evVinFastSlugs.length} rooms`);

  console.log('6. Fetching Elevator (839)...');
  const elevatorSlugs = await fetchAllSlugsForTerm('listivo_9126', 839);
  console.log(`   Found ${elevatorSlugs.length} rooms`);

  console.log('7. Fetching Foreign Guest Allowed (2189)...');
  const foreignGuestSlugs = await fetchAllSlugsForTerm('listivo_147398', 2189);
  console.log(`   Found ${foreignGuestSlugs.length} rooms`);

  console.log('8. Fetching Loft Allowed (856)...');
  const loftSlugs = await fetchAllSlugsForTerm('listivo_9134', 856);
  console.log(`   Found ${loftSlugs.length} rooms`);

  // Save to file
  const officialAttributes = {
    petAllowedSlugs,
    petForbiddenSlugs,
    evAllowedSlugs,
    evForbiddenSlugs,
    evVinFastSlugs,
    elevatorSlugs,
    foreignGuestSlugs,
    loftSlugs
  };
  fs.writeFileSync('moithue_official_attributes.json', JSON.stringify(officialAttributes, null, 2), 'utf8');
  console.log('✅ Saved moithue_official_attributes.json successfully!');
}

main().catch(console.error);
