const puppeteer = require("puppeteer");
const { createBrowser } = require('./browser');
const { randomInt } = require('./fonction')
const fs = require('fs');
const moment = require('moment');
const csvWriter = require('csv-writer').createObjectCsvWriter;


async function launchBrowser(url, retryCount = 5) {
    const browser = await createBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    let attempt = 1;
    while (attempt <= retryCount) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2' });
            console.log(`Instance créer en ${attempt} tentative(s)`)
            break;
        } catch (error) {
            console.error(`Tentative ${attempt} echouer`);
            attempt++;
        }
    }
    return page;
}



// saisair les 
async function setAndValidateSearch(page, data) {
    const selecteur = { input1: "input#whatwho", input2: "input#where", search: ".search-form__button" };

    // attendre que les 2 input searchs soient visibles
    await page.waitForSelector(selecteur.input1, { visible: true });
    await page.waitForSelector(selecteur.input2, { visible: true });

    await page.type(selecteur.input1, data.besoin, { delay: randomInt(150, 300) });
    await page.waitForTimeout(randomInt(80, 150));
    await page.type(selecteur.input2, data.destination, { delay: randomInt(150, 300) });
    await page.waitForTimeout(randomInt(70, 150));

    const acceptButton = await page.$(selecteur.search);
    await acceptButton.click();
}

const dataUtils = { totalResultats: null, totalPages: null, currentPageStop: 1, totalValueSave: 0 };
let dataTabFinal = [];

async function extractData(page, quantite = 20) {
    const selecteur = {
        resultsTotal: ".resultCount",
        pagesTotal: ".pageCount span:last-child",
        btnNext: "a[data-analytics*=next_serp]"
    };

    // Attendre que la liste soit chargée
    await page.waitForSelector('.resultList.jsResultsList.jsMLRContainer', { visible: true });

    // Obtenir le nombre total de résultats
    const textTotalResultats = await page.$eval(selecteur.resultsTotal, el => el.textContent);
    dataUtils.totalResultats = parseInt(textTotalResultats.match(/\((\d+)\s/)[1]);

    // Obtenir le nombre total de pages
    const textTotalPages = await page.$eval(selecteur.pagesTotal, el => el.textContent);
    dataUtils.totalPages = Number(textTotalPages);

    // Boucler sur les pages pour récupérer les données
    while (dataUtils.totalValueSave < quantite && dataUtils.currentPageStop <= dataUtils.totalPages) {
        const elements = await page.$$eval('.listing.listing--bottomcta', liElements => {
            return liElements.map(li => {
                const entreprise = li.querySelector('.listing__name--link')?.textContent.trim() || null;
                const telephone = li.querySelector('.mlr__submenu__item  h4')?.textContent.trim() || null;
                const rue = li.querySelector('span[itemprop="streetAddress"]')?.textContent.trim() || null;
                const ville = li.querySelector('span[itemprop="addressLocality"]')?.textContent.trim() || null;
                const codePostale = li.querySelector('span[itemprop="postalCode"]')?.textContent.trim() || null;
                const horaires = li.querySelector('.merchant__status')?.textContent.trim() || null;
                return { entreprise, telephone, rue, ville, codePostale, horaires };
            });
        });

        // Ajouter les éléments récupérés à dataTabFinal
        dataTabFinal.push(...elements.slice(0, quantite - dataUtils.totalValueSave));

        // Mettre à jour le nombre de valeurs enregistrées
        dataUtils.totalValueSave = dataTabFinal.length;

        // Passer à la page suivante
        if (dataUtils.currentPageStop < dataUtils.totalPages && dataTabFinal.length < quantite) {
            try {
                let btnNext = null;
                await Promise.all([
                    await page.waitForSelector(selecteur.btnNext, { visible: true }),
                    btnNext = await page.$(selecteur.btnNext),
                    await btnNext.click(),
                    await page.waitForSelector('.resultList.jsResultsList.jsMLRContainer', { visible: true }),
                ]);
                dataUtils.currentPageStop++;
            } catch (err) {
                console.log(`Erreur : impossible de passer à la page suivante (${err.message})`);
                break;
            }
        }
    }

    console.log(dataTabFinal);
    console.log(dataUtils);
    return dataTabFinal;
}


async function saveDataToCsv(valueSearch) {
    // Vérifier si le dossier de sauvegarde existe, sinon le créer
    if (!fs.existsSync('db')) {
        fs.mkdirSync('db');
    }
    const dateScrap = new Date().toLocaleString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });

    const dayOfWeek = moment().locale('fr').format('dddd');
    const currentDate = moment().locale('fr').format(`[${dayOfWeek}]-DD-MMMM-YYYY-[à]-HH[h]mm`).replace(/\s+/g, '-');
    const csvFilePath = `db/${valueSearch.besoin}-${valueSearch.destination}-${currentDate}.csv`;

    // Créer le fichier CSV
    let csvContent = `Entreprise,Téléphone,Rue,Ville,Code Postale,Horaires\n`;

    const records = dataTabFinal.map((item) => ({
        entreprise: item.entreprise?.replace(/,/g, '') ?? '',
        telephone: item.telephone?.replace(/,/g, '') ?? '',
        rue: item.rue?.replace(/,/g, '') ?? '',
        ville: item.ville?.replace(/,/g, '') ?? '',
        codePostale: item.codePostale?.replace(/,/g, '') ?? '',
        horaires: item.horaires?.replace(/,/g, '') ?? '',
    }));


    // Ajouter chaque enregistrement dans le fichier CSV
    for (let record of records) {
        csvContent += `${record.entreprise},${record.telephone},${record.rue},${record.ville},${record.codePostale},${record.horaires}\n`;
    }

    // Ajouter les informations au début du fichier CSV
    const dateExtract = `Date de création : Le ${dateScrap}\n`;
    const searchResults = `Recherche effectuée : ${valueSearch.besoin} à ${valueSearch.destination}\n`;
    const totalResults = `Nombre de résultats trouvés sur le site : ${dataUtils.totalResultats} sur ${dataUtils.totalPages} pages\n`;
    const savedResults = `Nombre de résultats que vous avez demandés et qui sont sauvegardés : ${dataUtils.totalValueSave} en parcourant ${dataUtils.currentPageStop} page(s)\n`;
    csvContent = dateExtract + searchResults + totalResults + savedResults + "\n\n" + csvContent;

    // Enregistrer le fichier CSV
    fs.writeFileSync(csvFilePath, csvContent, 'utf8');
}



// async function saveDataToCsv(valueSearch) {
// // Vérifier si le dossier de sauvegarde existe, sinon le créer
// if (!fs.existsSync('db')) {
//     fs.mkdirSync('db');
// }

// const dayOfWeek = moment().locale('fr').format('dddd');
// const currentDate = moment().locale('fr').format(`[${dayOfWeek}]-DD-MMMM-YYYY-[à]-HH[h]mm`).replace(/\s+/g, '-');

// const csvFilePath = `db/${valueSearch.besoin}-${valueSearch.destination}-${currentDate}.csv`;
//     const csvWriterObj = csvWriter({
//         path: csvFilePath,
//         header: [
//             { id: 'entreprise', title: 'Entreprise', header: 30 },
//             { id: 'telephone', title: 'Téléphone', header: 20 },
//             { id: 'rue', title: 'Rue', header: 30 },
//             { id: 'ville', title: 'Ville', header: 12 },
//             { id: 'codePostale', title: 'Code postal', header: 12 },
//             { id: 'horaires', title: 'Horaires', header: 12 }
//         ],
//         encoding: "utf8",
//         append: false // overwrite the file if it exists
//     });

// const records = dataTabFinal.map((item) => ({
//     entreprise: item.entreprise,
//     telephone: item.telephone,
//     rue: item.rue,
//     ville: item.ville,
//     codePostale: item.codePostale,
//     horaires: item.horaires
// }));

//     // Write CSV file
//     csvWriterObj.writeRecords(records)
//         .then(() => {
//             console.log(`CSV file created at ${csvFilePath}`);
//         })
//         .catch((err) => {
//             console.error(err);
//         });

//     const searchResults = `Recherche effectuée : ${valueSearch.besoin} à ${valueSearch.destination}`;
//     const totalResults = `Nombre de résultats trouvés sur le site : ${dataUtils.totalResultats} sur ${dataUtils.totalPages} pages`;
//     const savedResults = `Nombre de résultats que vous avez demandés et qui sont sauvegardés : ${dataUtils.totalValueSave} en parcourant ${dataUtils.currentPageStop} page(s)`;

//     const text = `${searchResults}\n${totalResults}\n${savedResults}\n\n\n`;
//     fs.appendFileSync(csvFilePath, text, { encoding: 'utf8' });

// }




module.exports = { launchBrowser, setAndValidateSearch, extractData, saveDataToCsv };
