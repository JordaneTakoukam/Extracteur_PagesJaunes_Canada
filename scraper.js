const { createBrowser } = require('./utils/browser');
const { launchBrowser, setAndValidateSearch, extractData, saveDataToCsv } = require('./utils/utils');

async function scraperPageJauneCa(data) {
    const browser = await createBrowser();
    const linkPage = "https://www.pagesjaunes.ca/";

    // essai de creer une instance de browser en 20 tentatives
    const page = await launchBrowser(linkPage, 20).catch(async (e) => {
        await browser.close();
        console.log("....... Impossible de demarer l'extraction ! .........");

    });



    console.log("....... En cours .........");

    // attendre que les 2 inputs soit charger, puis renseigner et valider
    await setAndValidateSearch(page, data);

    // extraction des données
    await extractData(page, data.quantite);
    console.log("....... Presque terminer .........");
    await browser.close();


    await saveDataToCsv(data);
    console.log("....... Terminer avec success .........");
}


module.exports = { scraperPageJauneCa };