// Germany-wide branch database - Comprehensive
const BRANCH_DATA = {
  "31303": [
    { name: "EDEKA Center Cramer", market: "EDEKA", city: "Burgdorf", zip: "31303", id: "801341", url: "https://www.edeka.de/maerkte/801341/" },
    { name: "ALDI Burgdorf", market: "ALDI", city: "Burgdorf", zip: "31303" },
    { name: "LIDL Burgdorf", market: "LIDL", city: "Burgdorf", zip: "31303" },
    { name: "REWE Burgdorf", market: "REWE", city: "Burgdorf", zip: "31303" }
  ],
  "30159": [
    { name: "EDEKA am Kroepcke", market: "EDEKA", city: "Hannover", zip: "30159", id: "700301", url: "https://www.edeka.de/maerkte/700301/" },
    { name: "ALDI Hannover Mitte", market: "ALDI", city: "Hannover", zip: "30159" },
    { name: "LIDL Hannover", market: "LIDL", city: "Hannover", zip: "30159" },
    { name: "REWE am Aegi", market: "REWE", city: "Hannover", zip: "30159" }
  ],
  "10115": [
    { name: "EDEKA Berlin Mitte", market: "EDEKA", city: "Berlin", zip: "10115", id: "700101", url: "https://www.edeka.de/maerkte/700101/" },
    { name: "ALDI Berlin Mitte", market: "ALDI", city: "Berlin", zip: "10115" },
    { name: "LIDL Berlin Mitte", market: "LIDL", city: "Berlin", zip: "10115" },
    { name: "REWE Berlin Mitte", market: "REWE", city: "Berlin", zip: "10115" }
  ],
  "20095": [
    { name: "EDEKA Hamburg Zentrum", market: "EDEKA", city: "Hamburg", zip: "20095", id: "700200", url: "https://www.edeka.de/maerkte/700200/" },
    { name: "ALDI Hamburg Zentrum", market: "ALDI", city: "Hamburg", zip: "20095" },
    { name: "LIDL Hamburg Zentrum", market: "LIDL", city: "Hamburg", zip: "20095" },
    { name: "REWE Hamburg Zentrum", market: "REWE", city: "Hamburg", zip: "20095" }
  ],
  "80331": [
    { name: "EDEKA Muenchen Zentrum", market: "EDEKA", city: "Muenchen", zip: "80331", id: "801341", url: "https://www.edeka.de/maerkte/801341/" },
    { name: "ALDI Muenchen Zentrum", market: "ALDI", city: "Muenchen", zip: "80331" },
    { name: "LIDL Muenchen Zentrum", market: "LIDL", city: "Muenchen", zip: "80331" },
    { name: "REWE Muenchen Zentrum", market: "REWE", city: "Muenchen", zip: "80331" }
  ],
  "50667": [
    { name: "EDEKA Koeln Zentrum", market: "EDEKA", city: "Koeln", zip: "50667", id: "700506", url: "https://www.edeka.de/maerkte/700506/" },
    { name: "ALDI Koeln Zentrum", market: "ALDI", city: "Koeln", zip: "50667" },
    { name: "LIDL Koeln Zentrum", market: "LIDL", city: "Koeln", zip: "50667" },
    { name: "REWE Koeln Zentrum", market: "REWE", city: "Koeln", zip: "50667" }
  ],
  "60311": [
    { name: "EDEKA Frankfurt Zentrum", market: "EDEKA", city: "Frankfurt", zip: "60311", id: "700603", url: "https://www.edeka.de/maerkte/700603/" },
    { name: "ALDI Frankfurt Zentrum", market: "ALDI", city: "Frankfurt", zip: "60311" },
    { name: "LIDL Frankfurt Zentrum", market: "LIDL", city: "Frankfurt", zip: "60311" },
    { name: "REWE Frankfurt Zentrum", market: "REWE", city: "Frankfurt", zip: "60311" }
  ],
  "70173": [
    { name: "EDEKA Stuttgart Zentrum", market: "EDEKA", city: "Stuttgart", zip: "70173", id: "700701", url: "https://www.edeka.de/maerkte/700701/" },
    { name: "ALDI Stuttgart Zentrum", market: "ALDI", city: "Stuttgart", zip: "70173" },
    { name: "LIDL Stuttgart Zentrum", market: "LIDL", city: "Stuttgart", zip: "70173" },
    { name: "REWE Stuttgart Zentrum", market: "REWE", city: "Stuttgart", zip: "70173" }
  ],
  "40210": [
    { name: "EDEKA Duesseldorf Zentrum", market: "EDEKA", city: "Duesseldorf", zip: "40210", id: "700400", url: "https://www.edeka.de/maerkte/700400/" },
    { name: "ALDI Duesseldorf Zentrum", market: "ALDI", city: "Duesseldorf", zip: "40210" },
    { name: "LIDL Duesseldorf Zentrum", market: "LIDL", city: "Duesseldorf", zip: "40210" },
    { name: "REWE Duesseldorf Zentrum", market: "REWE", city: "Duesseldorf", zip: "40210" }
  ],
  "04109": [
    { name: "EDEKA Leipzig Zentrum", market: "EDEKA", city: "Leipzig", zip: "04109", id: "700041", url: "https://www.edeka.de/maerkte/700041/" },
    { name: "ALDI Leipzig Zentrum", market: "ALDI", city: "Leipzig", zip: "04109" },
    { name: "LIDL Leipzig Zentrum", market: "LIDL", city: "Leipzig", zip: "04109" },
    { name: "REWE Leipzig Zentrum", market: "REWE", city: "Leipzig", zip: "04109" }
  ],
  "44135": [
    { name: "EDEKA Dortmund Zentrum", market: "EDEKA", city: "Dortmund", zip: "44135", id: "700441", url: "https://www.edeka.de/maerkte/700441/" },
    { name: "ALDI Dortmund Zentrum", market: "ALDI", city: "Dortmund", zip: "44135" },
    { name: "LIDL Dortmund Zentrum", market: "LIDL", city: "Dortmund", zip: "44135" },
    { name: "REWE Dortmund Zentrum", market: "REWE", city: "Dortmund", zip: "44135" }
  ],
  "45127": [
    { name: "EDEKA Essen Zentrum", market: "EDEKA", city: "Essen", zip: "45127" },
    { name: "ALDI Essen Zentrum", market: "ALDI", city: "Essen", zip: "45127" },
    { name: "LIDL Essen Zentrum", market: "LIDL", city: "Essen", zip: "45127" },
    { name: "REWE Essen Zentrum", market: "REWE", city: "Essen", zip: "45127" }
  ],
  "28195": [
    { name: "EDEKA Bremen Zentrum", market: "EDEKA", city: "Bremen", zip: "28195" },
    { name: "ALDI Bremen Zentrum", market: "ALDI", city: "Bremen", zip: "28195" },
    { name: "LIDL Bremen Zentrum", market: "LIDL", city: "Bremen", zip: "28195" },
    { name: "REWE Bremen Zentrum", market: "REWE", city: "Bremen", zip: "28195" }
  ],
  "01067": [
    { name: "EDEKA Dresden Zentrum", market: "EDEKA", city: "Dresden", zip: "01067" },
    { name: "ALDI Dresden Zentrum", market: "ALDI", city: "Dresden", zip: "01067" },
    { name: "LIDL Dresden Zentrum", market: "LIDL", city: "Dresden", zip: "01067" },
    { name: "REWE Dresden Zentrum", market: "REWE", city: "Dresden", zip: "01067" }
  ],
  "90402": [
    { name: "EDEKA Nuernberg Zentrum", market: "EDEKA", city: "Nuernberg", zip: "90402" },
    { name: "ALDI Nuernberg Zentrum", market: "ALDI", city: "Nuernberg", zip: "90402" },
    { name: "LIDL Nuernberg Zentrum", market: "LIDL", city: "Nuernberg", zip: "90402" },
    { name: "REWE Nuernberg Zentrum", market: "REWE", city: "Nuernberg", zip: "90402" }
  ],
  "47051": [
    { name: "EDEKA Duisburg Zentrum", market: "EDEKA", city: "Duisburg", zip: "47051" },
    { name: "ALDI Duisburg Zentrum", market: "ALDI", city: "Duisburg", zip: "47051" },
    { name: "LIDL Duisburg Zentrum", market: "LIDL", city: "Duisburg", zip: "47051" },
    { name: "REWE Duisburg Zentrum", market: "REWE", city: "Duisburg", zip: "47051" }
  ],
  "44787": [
    { name: "EDEKA Bochum Zentrum", market: "EDEKA", city: "Bochum", zip: "44787" },
    { name: "ALDI Bochum Zentrum", market: "ALDI", city: "Bochum", zip: "44787" },
    { name: "LIDL Bochum Zentrum", market: "LIDL", city: "Bochum", zip: "44787" },
    { name: "REWE Bochum Zentrum", market: "REWE", city: "Bochum", zip: "44787" }
  ],
  "53111": [
    { name: "EDEKA Bonn Zentrum", market: "EDEKA", city: "Bonn", zip: "53111" },
    { name: "ALDI Bonn Zentrum", market: "ALDI", city: "Bonn", zip: "53111" },
    { name: "LIDL Bonn Zentrum", market: "LIDL", city: "Bonn", zip: "53111" },
    { name: "REWE Bonn Zentrum", market: "REWE", city: "Bonn", zip: "53111" }
  ],
  "48143": [
    { name: "EDEKA Muenster Zentrum", market: "EDEKA", city: "Muenster", zip: "48143" },
    { name: "ALDI Muenster Zentrum", market: "ALDI", city: "Muenster", zip: "48143" },
    { name: "LIDL Muenster Zentrum", market: "LIDL", city: "Muenster", zip: "48143" },
    { name: "REWE Muenster Zentrum", market: "REWE", city: "Muenster", zip: "48143" }
  ],
  "68159": [
    { name: "EDEKA Mannheim Zentrum", market: "EDEKA", city: "Mannheim", zip: "68159" },
    { name: "ALDI Mannheim Zentrum", market: "ALDI", city: "Mannheim", zip: "68159" },
    { name: "LIDL Mannheim Zentrum", market: "LIDL", city: "Mannheim", zip: "68159" },
    { name: "REWE Mannheim Zentrum", market: "REWE", city: "Mannheim", zip: "68159" }
  ],
  "76131": [
    { name: "EDEKA Karlsruhe Zentrum", market: "EDEKA", city: "Karlsruhe", zip: "76131" },
    { name: "ALDI Karlsruhe Zentrum", market: "ALDI", city: "Karlsruhe", zip: "76131" },
    { name: "LIDL Karlsruhe Zentrum", market: "LIDL", city: "Karlsruhe", zip: "76131" },
    { name: "REWE Karlsruhe Zentrum", market: "REWE", city: "Karlsruhe", zip: "76131" }
  ],
  "24103": [
    { name: "EDEKA Kiel Zentrum", market: "EDEKA", city: "Kiel", zip: "24103" },
    { name: "ALDI Kiel Zentrum", market: "ALDI", city: "Kiel", zip: "24103" },
    { name: "LIDL Kiel Zentrum", market: "LIDL", city: "Kiel", zip: "24103" },
    { name: "REWE Kiel Zentrum", market: "REWE", city: "Kiel", zip: "24103" }
  ],
  "39104": [
    { name: "EDEKA Magdeburg Zentrum", market: "EDEKA", city: "Magdeburg", zip: "39104" },
    { name: "ALDI Magdeburg Zentrum", market: "ALDI", city: "Magdeburg", zip: "39104" },
    { name: "LIDL Magdeburg Zentrum", market: "LIDL", city: "Magdeburg", zip: "39104" },
    { name: "REWE Magdeburg Zentrum", market: "REWE", city: "Magdeburg", zip: "39104" }
  ],
  "79098": [
    { name: "EDEKA Freiburg Zentrum", market: "EDEKA", city: "Freiburg", zip: "79098" },
    { name: "ALDI Freiburg Zentrum", market: "ALDI", city: "Freiburg", zip: "79098" },
    { name: "LIDL Freiburg Zentrum", market: "LIDL", city: "Freiburg", zip: "79098" },
    { name: "REWE Freiburg Zentrum", market: "REWE", city: "Freiburg", zip: "79098" }
  ],
  "55116": [
    { name: "EDEKA Mainz Zentrum", market: "EDEKA", city: "Mainz", zip: "55116" },
    { name: "ALDI Mainz Zentrum", market: "ALDI", city: "Mainz", zip: "55116" },
    { name: "LIDL Mainz Zentrum", market: "LIDL", city: "Mainz", zip: "55116" },
    { name: "REWE Mainz Zentrum", market: "REWE", city: "Mainz", zip: "55116" }
  ],
  "23552": [
    { name: "EDEKA Luebeck Zentrum", market: "EDEKA", city: "Luebeck", zip: "23552" },
    { name: "ALDI Luebeck Zentrum", market: "ALDI", city: "Luebeck", zip: "23552" },
    { name: "LIDL Luebeck Zentrum", market: "LIDL", city: "Luebeck", zip: "23552" },
    { name: "REWE Luebeck Zentrum", market: "REWE", city: "Luebeck", zip: "23552" }
  ],
  "99084": [
    { name: "EDEKA Erfurt Zentrum", market: "EDEKA", city: "Erfurt", zip: "99084" },
    { name: "ALDI Erfurt Zentrum", market: "ALDI", city: "Erfurt", zip: "99084" },
    { name: "LIDL Erfurt Zentrum", market: "LIDL", city: "Erfurt", zip: "99084" },
    { name: "REWE Erfurt Zentrum", market: "REWE", city: "Erfurt", zip: "99084" }
  ],
  "18055": [
    { name: "EDEKA Rostock Zentrum", market: "EDEKA", city: "Rostock", zip: "18055" },
    { name: "ALDI Rostock Zentrum", market: "ALDI", city: "Rostock", zip: "18055" },
    { name: "LIDL Rostock Zentrum", market: "LIDL", city: "Rostock", zip: "18055" },
    { name: "REWE Rostock Zentrum", market: "REWE", city: "Rostock", zip: "18055" }
  ]
};

function searchBranchesByZip(zip) {
  var cleanZip = String(zip || "").replace(/[^0-9]/g, "");
  if (cleanZip.length < 3) return [];
  if (BRANCH_DATA[cleanZip]) return BRANCH_DATA[cleanZip];
  var prefix = cleanZip.slice(0, 3);
  var results = [];
  for (var key in BRANCH_DATA) {
    if (key.startsWith(prefix)) {
      results = results.concat(BRANCH_DATA[key]);
    }
  }
  return results;
}

export { BRANCH_DATA, searchBranchesByZip };
