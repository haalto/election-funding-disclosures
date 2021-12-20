import axios from "axios";
import cheerio, { Element } from "cheerio";

/**
 * Scraper for parsing Election Funding Disclosures into JSON
 * https://www.vaalirahoitusvalvonta.fi/en/index/vaalirahailmoituksia.html
 */

const parliamentElectionsURI =
  "https://www.vaalirahoitusvalvonta.fi/en/index/vaalirahailmoituksia/ilmoituslistaus/EV2019.html";

const getListOfRegionURIs = async () => {
  const response = await axios.get(parliamentElectionsURI);

  if (response.status !== 200) {
    throw new Error("Failed to load");
  }

  const $ = cheerio.load(response.data);
  return $("p")
    .find("a")
    .toArray()
    .map((value) => {
      const link = $(value).attr("href");
      if (link) {
        return link;
      } else {
        undefined;
      }
    })
    .filter((u) => u);
};

const getListOfFundingDisclosuresFromRegionURIs = async (uris: string[]) => {
  return (
    await Promise.all(
      uris.map(async (uri) => {
        const response = await axios.get(uri);
        const $ = cheerio.load(response.data);
        return $("td")
          .find("a")
          .toArray()
          .map((value) => {
            const node = $(value);
            if (node.text().trim() === "Funding disclosure") {
              return $(value).attr("href");
            } else {
              return undefined;
            }
          });
      })
    )
  )
    .filter((t) => t)
    .flat();
};

const getRawFundingDisclosure = async (uri: string) => {
  const response = await axios.get(uri);
  const $ = cheerio.load(response.data);
  return $('div[class="ann_form"]').html();
};

const parseA = (data: Element) => {
  const $ = cheerio.load(data);
  const [name, title, party, district, _, supportGroup] = $("td")
    .toArray()
    .map((value) => $(value).text().trim());
  return { name, title, party, district, supportGroup };
};

const parseBandC = (data: Element) => {
  const $ = cheerio.load(data);
  const parsedData = $("tr")
    .toArray()
    .map((value) => {
      const section = $(value).find("th").text().trim();
      const amount = Number(
        $(value)
          .find("td")
          .text()
          .trim()
          .replace(",", ".")
          .replace(/(\r\n|\n|\r|\t)|eur|\s/gm, "")
      );
      const currency = $(value)
        .find("td")
        .text()
        .trim()
        .split("\n")
        .at(-1)
        ?.trim();
      return { section, amount, currency };
    });

  return parsedData.reduce(
    (obj: { [key: string]: Object }, item) => ({
      ...obj,
      [item.section]: { amount: item.amount, currency: item.currency },
    }),
    {}
  );
};

const parseC = (data: Element) => {};

const parseD = (data: Element) => {};

const parseE = (data: Element) => {};

const parseRawFundingDisclosure = (rawData: string) => {
  const $ = cheerio.load(rawData);
  const formData = $('div[class="ann_form_table_basic"]').toArray();

  //These are form sections from the disclosure form
  const [A, B, C, D, E] = formData;

  return {
    A: parseA(A),
    B: parseBandC(B),
    C: parseBandC(C),
    D: parseD(D),
    E: parseE(E),
  };
};

(async () => {
  const homeURI = "https://www.vaalirahoitusvalvonta.fi/";
  const regionURIs = await getListOfRegionURIs();
  console.log(regionURIs);
  const completeRegionURIs = regionURIs.map((uri) => `${homeURI}${uri}`);
  const fundingDisclosureURIs = await getListOfFundingDisclosuresFromRegionURIs(
    completeRegionURIs.slice(0, 2)
  );
  const completeFundingDisclosureURIs = fundingDisclosureURIs.map(
    (uri) => `${homeURI}${uri}`
  );
  const rawFundingDisclosure = await getRawFundingDisclosure(
    completeFundingDisclosureURIs[6]
  );

  const parsedFundingDisclosure = parseRawFundingDisclosure(
    rawFundingDisclosure as string
  );
  console.log(parsedFundingDisclosure);
})();
