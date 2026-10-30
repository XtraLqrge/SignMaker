/*
  ShieldPicker.js - shield type picker from SignMaker v2.19.
  A tree of shields with icons. It drives a hidden native <select>,
  which stays the source of truth for the editor.
*/

const ShieldPicker = (() => {
  const SCROLL_STORAGE_KEY = "signMaker.shieldPickerScrollTop";
  const readStoredScrollTop = () => {
    try {
      return window.localStorage.getItem(SCROLL_STORAGE_KEY);
    } catch (error) {
      return null;
    }
  };
  const writeStoredScrollTop = (value) => {
    try {
      window.localStorage.setItem(SCROLL_STORAGE_KEY, value);
    } catch (error) {}
  };
  const api = {};

  const SHIELD_DROPDOWN_PLACEHOLDER_ICON =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <rect x="4" y="4" width="40" height="40" rx="4" fill="#111" stroke="#666" stroke-width="2"/>
        <path d="M12 32 L32 12 M24 12 H32 V20" stroke="#888" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `);

  const SHIELD_PICKER_MANUAL_ORDER = {

    "us-florida": [
      "FL",
      "FLToll",
      "FLCFX",
      "FLTP",
    ],

    "us-georgia": [
      "GA",
      "GAALT",
      "GABYP",
      "GACONN",
      "GALOOP",
      "GASPUR",
    ],

    "us-massachusetts": [
      "MA",
      "MATP",
      "MA-PIKE",
    ],

    "us-nevada": [
      "NV",
      "NVCC",
    ],

    "us-newjersey": [
      "NJ",
      "NJTP",
      "GSP",
      "PIP",
    ],

    "us-oklahoma": [
      "OK",
      "OKCH",
      "OKCR",
      "OKHB",
      "OKIN",
      "OKKC",
      "OKKL",
      "OKMS",
      "OKTU",
      "OKWR",
    ],

    "us-pennsylvania": [
      "PA",
      "PATPLOGO",
      "PATP",
    ],

    "us-puertorico": [
      "PR",
      "PR2",
      "PR3",
      "PR4",
    ],

    "us-texas": [
      "TX",
      "TXFM",
      "TXRM",
      "TXBELT",
      "TXLOOP",
      "TXPARK",
      "TXSPUR",
      "TXEXPRESS",
      "TXTOLL",
      "TXTOLLCTRMA",
      "TXTOLLNTTA",
      "TXTOLLFBTR",
      "HTR",
      "SHT",
      "WPT",
    ],

    "canada": [
      "TCHLeaf",
      "TCH",
    ],
  };

  const applyManualShieldPickerOrder = (node) => {
    if (!node || !Array.isArray(node.children)) {
      return node;
    }

    node.children.forEach(applyManualShieldPickerOrder);

    const manualOrder = SHIELD_PICKER_MANUAL_ORDER[node.id];

    if (!manualOrder) {
      return node;
    }

    const orderMap = new Map(
      manualOrder.map((value, index) => [value, index])
    );

    node.children.sort((a, b) => {
      const aIndex = orderMap.has(a.value) ? orderMap.get(a.value) : 9999;
      const bIndex = orderMap.has(b.value) ? orderMap.get(b.value) : 9999;

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      return (a.label || a.value || "").localeCompare(b.label || b.value || "");
    });

    return node;
  };

  const SHIELD_PICKER_CUSTOM_MAKER_VALUE = "__customShieldMaker";
  const activeShieldPickerApis = new Set();

  const refreshAllShieldPickers = () => {
    activeShieldPickerApis.forEach((pickerApi) => {
      if (pickerApi && typeof pickerApi.refresh === "function") {
        pickerApi.refresh();
      }
    });
  };


  const SHIELD_PICKER_TREE = [
    {
      id: "us",
      label: "United States",
      children: [
        {
          id: "us-interstate",
          label: "Interstate",
          children: [
            { value: "I", label: "Interstate", asset: "img/shields/United States/I-2Digit.svg" },
            { value: "I-BUS", label: "Interstate Business", asset: "img/shields/United States/I-BUS-2Digit.svg" },
            { value: "I-BUS-LOOP", label: "Interstate Business Loop", disabled: true },
            { value: "I-BUS-SPUR", label: "Interstate Business Spur", disabled: true },
            { value: "FUTURE-I", label: "Future Interstate", disabled: true },
          ],
        },
        {
          id: "us-usroute",
          label: "U.S. Route",
          children: [
            { value: "US", label: "U.S. Route", asset: "img/shields/United States/US-2Digit.svg" },
            { value: "US-OLD", label: "U.S. Route (old style)", disabled: true },
            { value: "US-CA", label: "U.S. Route (CA style)", disabled: true },
          ],
        },

        { value: "AL", label: "Alabama", asset: "img/shields/United States/AL-2Digit.svg" },
        { value: "AK", label: "Alaska", asset: "img/shields/United States/AK-2Digit.svg" },
        { value: "AZ", label: "Arizona", asset: "img/shields/United States/AZ/AZ-2Digit.svg" },
        { value: "AR", label: "Arkansas", asset: "img/shields/United States/AR-2Digit.svg" },
        { value: "CA", label: "California", asset: "img/shields/United States/CA-2Digit.svg" },
        { value: "CO", label: "Colorado", asset: "img/shields/United States/CO-2Digit.svg" },
        { value: "CT", label: "Connecticut", asset: "img/shields/United States/CT-2Digit.svg" },
        { value: "DE", label: "Delaware", asset: "img/shields/United States/DE-2Digit.svg" },
        { value: "DC", label: "District of Columbia", asset: "img/shields/United States/DC-2Digit.svg" },

        {
          id: "us-florida",
          label: "Florida",
          children: [
            {
              value: "FL",
              label: "Florida",
              asset: "img/shields/United States/Florida/FDOT/FL-36-2Digit.svg",
            },
            {
              value: "FLToll",
              label: "FDOT Toll",
              asset: "img/shields/United States/Florida/FDOT/TollFDOT-48.svg",
            },
            {
              value: "FLCFX",
              label: "CFX Toll",
              asset: "img/shields/United States/Florida/CFX/CFX-48.svg",
            },
            {
              value: "FLTP",
              label: "Florida's Turnpike",
              asset: "img/shields/United States/Florida/FDOT/FLTP-48.svg",
            },
          ],
        },

        {
          id: "us-georgia",
          label: "Georgia",
          children: [
            { value: "GA", label: "Georgia", asset: "img/shields/United States/GA/GA-2Digit.svg" },
            { value: "GAALT", label: "GA Alternate", disabled: true },
            { value: "GABYP", label: "GA Bypass", disabled: true },
            { value: "GACONN", label: "GA Connector", disabled: true },
            { value: "GALOOP", label: "GA Loop", disabled: true },
            { value: "GASPUR", label: "GA Spur", disabled: true },
          ],
        },

        { value: "HI", label: "Hawaii", asset: "img/shields/United States/HI-2Digit.svg" },
        { value: "ID", label: "Idaho", asset: "img/shields/United States/ID-2Digit.svg" },
        { value: "IL", label: "Illinois", asset: "img/shields/United States/IL-2Digit.svg" },

        {
          id: "us-indiana",
          label: "Indiana",
          children: [
            { value: "IN", label: "Indiana", asset: "img/shields/United States/IN/IN-2Digit.svg" },
            { value: "IN-TOLL", label: "IN Toll Road", disabled: true },
          ],
        },

        { value: "IA", label: "Iowa", asset: "img/shields/United States/IA-2Digit.svg" },

        {
          id: "us-kansas",
          label: "Kansas",
          children: [
            { value: "KS", label: "Kansas", asset: "img/shields/United States/KS/KS-2Digit.svg" },
            { value: "KS-TURNPIKE", label: "KS Turnpike", disabled: true },
          ],
        },

        {
          id: "us-kentucky",
          label: "Kentucky",
          children: [
            { value: "KY", label: "Kentucky", asset: "img/shields/United States/KY/KY-2Digit.svg" },
            {
              id: "us-kentucky-parkways",
              label: "KY Parkways",
              children: [
                { value: "KY-AA", label: "AA Highway", disabled: true },
                { value: "KY-AUDUBON", label: "Audubon Parkway", disabled: true },
                { value: "KY-BLUEGRASS", label: "Bluegrass Parkway", disabled: true },
                { value: "KY-HALROGERS", label: "Hal Rogers Parkway", disabled: true },
                { value: "KY-MOUNTAIN", label: "Mountain Parkway", disabled: true },
                { value: "KY-NATCHER", label: "Natcher Parkway", disabled: true },
                { value: "KY-PENNYRILE", label: "Pennyrile Parkway", disabled: true },
                { value: "KY-PURCHASE", label: "Purchase Parkway", disabled: true },
                { value: "KY-WESTERN", label: "Western KY Parkway", disabled: true },
              ],
            },
          ],
        },

        { value: "LA", label: "Louisiana", asset: "img/shields/United States/LA/LA-2Digit.svg" },
        { value: "ME", label: "Maine", asset: "img/shields/United States/ME/ME-2Digit.svg" },
        { value: "MD", label: "Maryland", asset: "img/shields/United States/MD-2Digit.svg" },

        {
          id: "us-massachusetts",
          label: "Massachusetts",
          children: [
            { value: "MA", label: "Massachusetts", asset: "img/shields/United States/MA/MA-2Digit.svg" },
            { value: "MA-PIKE", label: "Mass Pike", disabled: true },
          ],
        },

        { value: "MI", label: "Michigan", asset: "img/shields/United States/MI-2Digit.svg" },
        {
          id: "us-minnesota",
          label: "Minnesota",
          children: [
            { value: "MN", label: "Minnesota", asset: "img/shields/United States/MN/MN-2Digit.svg" },
            { value: "MNBUS", label: "Minnesota Business", asset: "img/shields/United States/MN/MNBUS-2Digit.svg" },
            { value: "MNCo", label: "Minnesota County", asset: "img/shields/United States/MN/MNCo-2Digit.svg" },
          ],
        },
        { value: "MS", label: "Mississippi", asset: "img/shields/United States/MS-2Digit.svg" },
        { value: "MO", label: "Missouri", asset: "img/shields/United States/MO-2Digit.svg" },

        {
          id: "us-montana",
          label: "Montana",
          children: [
            { value: "MT", label: "Montana", asset: "img/shields/United States/MT-2Digit.svg" },
            { value: "MT2", label: "Montana (secondary)", asset: "img/shields/United States/MT2-2Digit.svg" },
          ],
        },

        {
          id: "us-nebraska",
          label: "Nebraska",
          children: [
            { value: "NE", label: "Nebraska", asset: "img/shields/United States/NE/NE-2Digit.svg" },
            { value: "NELINK", label: "NE Link", disabled: true },
            { value: "NESPUR", label: "NE Spur", disabled: true },
          ],
        },

        {
          id: "us-nevada",
          label: "Nevada",
          children: [
            { value: "NV", label: "Nevada", asset: "img/shields/United States/NV/NV-2Digit.svg" },
            { value: "NVCC", label: "Clark County", asset: "img/shields/United States/NV/NVCC-2Digit.svg" },
          ],
        },
        { value: "NH", label: "New Hampshire", asset: "img/shields/United States/NH-2Digit.svg" },


            {
              id: "us-newjersey",
              label: "New Jersey",
              children: [
                { value: "NJ", label: "New Jersey", asset: "img/shields/United States/NJ/NJ-2Digit.svg" },
                { value: "GSP", label: "Garden State Parkway", asset: "img/shields/United States/NJ/GSP.png" },
                { value: "NJTP", label: "NJ Turnpike", asset: "img/shields/United States/NJ/NJTP.png" },
                { value: "PIP", label: "Palisades Interstate Parkway", asset: "img/shields/United States/NJ/PIP.png" },
              ],
            },

        { value: "NM", label: "New Mexico", asset: "img/shields/United States/NM-2Digit.svg" },

            {
              id: "us-newyork",
              label: "New York",
              children: [
                { value: "NY", label: "New York", asset: "img/shields/United States/NY/NY-2Digit.svg" },
                { value: "NYST", label: "NY State Thruway", asset: "img/shields/United States/NY/NYST.png" },
                {
                  id: "us-newyork-parkways",
                  label: "NY Parkways",
                  children: [
                    { value: "B", label: "Bethpage Parkway", asset: "img/shields/United States/NY/B.png" },
                    { value: "BMP", label: "Bear Mountain Parkway", asset: "img/shields/United States/NY/BMP.png" },
                    { value: "BP", label: "Belt Parkway", asset: "img/shields/United States/NY/BP.png" },
                    { value: "BR", label: "Bronx River Parkway", asset: "img/shields/United States/NY/BR.png" },
                    { value: "BRP", label: "Bronx River Parkway", asset: "img/shields/United States/NY/BRP.png" },
                    { value: "CCP", label: "Cross County Parkway", asset: "img/shields/United States/NY/CCP.png" },
                    { value: "CI", label: "Cross Island Parkway", asset: "img/shields/United States/NY/CI.png" },
                    { value: "FDR", label: "FDR Drive", asset: "img/shields/United States/NY/FDR.png" },
                    { value: "GCP", label: "Grand Central Parkway", asset: "img/shields/United States/NY/GCP.png" },
                    { value: "H", label: "Heckscher Parkway", asset: "img/shields/United States/NY/H.png" },
                    { value: "HH", label: "Henry Hudson Parkway", asset: "img/shields/United States/NY/HH.png" },
                    { value: "HR", label: "Hutchinson River Parkway", asset: "img/shields/United States/NY/HR.png" },
                    { value: "HRD", label: "Harlem River Drive", asset: "img/shields/United States/NY/HRD.png" },
                    { value: "HRP", label: "Hutchinson River Parkway", asset: "img/shields/United States/NY/HRP.png" },
                    { value: "JR", label: "Jackie Robinson Parkway", asset: "img/shields/United States/NY/JR.png" },
                    { value: "KWV", label: "Korean War Veterans Parkway", asset: "img/shields/United States/NY/KWV.png" },
                    { value: "LOSP", label: "Lake Ontario State Parkway", asset: "img/shields/United States/NY/LOSP.png" },
                    { value: "M", label: "Meadowbrook Parkway", asset: "img/shields/United States/NY/M.png" },
                    { value: "MP", label: "Mosholu Parkway", asset: "img/shields/United States/NY/MP.png" },
                    { value: "N", label: "Northern State Parkway", asset: "img/shields/United States/NY/N.png" },
                    { value: "NSP", label: "Niagara Scenic Parkway", asset: "img/shields/United States/NY/NSP.png" },
                    { value: "O", label: "Ocean Parkway", asset: "img/shields/United States/NY/O.png" },
                    { value: "Pe", label: "Pelham Parkway", asset: "img/shields/United States/NY/Pe.png" },
                    { value: "PIP", label: "Palisades Interstate Parkway", asset: "img/shields/United States/NY/PIP.png" },
                    { value: "RM", label: "Robert Moses Causeway", asset: "img/shields/United States/NY/RM.png" },
                    { value: "SA", label: "Sagtikos Parkway", asset: "img/shields/United States/NY/SA.png" },
                    { value: "SBP", label: "Sprain Brook Parkway", asset: "img/shields/United States/NY/SBP.png" },
                    { value: "SM", label: "Sunken Meadow Parkway", asset: "img/shields/United States/NY/SM.png" },
                    { value: "SMP", label: "Saw Mill Parkway", asset: "img/shields/United States/NY/SMP.png" },
                    { value: "SO", label: "Southern State Parkway", asset: "img/shields/United States/NY/SO.png" },
                    { value: "TSP", label: "Taconic State Parkway", asset: "img/shields/United States/NY/TSP.png" },
                    { value: "W", label: "Wantagh Parkway", asset: "img/shields/United States/NY/W.png" },
                  ],
                },
              ],
            },

        { value: "NC", label: "North Carolina", asset: "img/shields/United States/NC-2Digit.svg" },
        { value: "ND", label: "North Dakota", asset: "img/shields/United States/ND-2Digit.svg" },

            {
              id: "us-ohio",
              label: "Ohio",
              children: [
                { value: "OH", label: "Ohio", asset: "img/shields/United States/OH/OH-2Digit.svg" },
                { value: "OHTP", label: "Ohio Turnpike", asset: "img/shields/United States/OH/OHTP.png" },
              ],
            },

            {
              id: "us-oklahoma",
              label: "Oklahoma",
              children: [
                { value: "OK", label: "Oklahoma", asset: "img/shields/United States/OK/OK-2Digit.svg" },
                { value: "OKCH", label: "Cherokee Turnpike", asset: "img/shields/United States/OK/OKCH.png" },
                { value: "OKCR", label: "Creek Turnpike", asset: "img/shields/United States/OK/OKCR.png" },
                { value: "OKHB", label: "H.E. Bailey Turnpike", asset: "img/shields/United States/OK/OKHB.png" },
                { value: "OKIN", label: "Indian Nation Turnpike", asset: "img/shields/United States/OK/OKIN.png" },
                { value: "OKKC", label: "Kickapoo Turnpike", asset: "img/shields/United States/OK/OKKC.png" },
                { value: "OKKL", label: "Kilpatrick Turnpike", asset: "img/shields/United States/OK/OKKL.png" },
                { value: "OKMS", label: "Muskogee Turnpike", asset: "img/shields/United States/OK/OKMS.png" },
                { value: "OKTU", label: "Turner Turnpike", asset: "img/shields/United States/OK/OKTU.png" },
                { value: "OKWR", label: "Will Rogers Turnpike", asset: "img/shields/United States/OK/OKWR.png" },
              ],
            },

        { value: "OR", label: "Oregon", asset: "img/shields/United States/OR-2Digit.svg" },

        {
          id: "us-pennsylvania",
          label: "Pennsylvania",
          children: [
            {
              value: "PA",
              label: "Pennsylvania",
              asset: "img/shields/United States/PA/PA-2Digit.svg"
            },
            {
              value: "PATPLOGO",
              label: "PA Turnpike",
              asset: "img/shields/United States/PA/PATP.png"
            },
            {
              value: "PATP",
              label: "PA Turnpike Route",
              asset: "img/shields/United States/PA/PATP-2Digit.svg"
            },
          ],
        },

        {
          id: "us-puertorico",
          label: "Puerto Rico",
          children: [
            { value: "PR", label: "PR Primary", asset: "img/shields/United States/PR/PR-2Digit.svg" },
            { value: "PR2", label: "PR Urban Primary", asset: "img/shields/United States/PR/PR2-2Digit.svg" },
            { value: "PR3", label: "PR Secondary", asset: "img/shields/United States/PR/PR3-2Digit.svg" },
            { value: "PR4", label: "PR Tertiary", asset: "img/shields/United States/PR/PR4-2Digit.svg" },
          ],
        },

        { value: "RI", label: "Rhode Island", asset: "img/shields/United States/RI-2Digit.svg" },
        { value: "SC", label: "South Carolina", asset: "img/shields/United States/SC-2Digit.svg" },
        { value: "SD", label: "South Dakota", asset: "img/shields/United States/SD-2Digit.svg" },

        {
          id: "us-tennessee",
          label: "Tennessee",
          children: [
            { value: "TN", label: "Tennessee", asset: "img/shields/United States/TN-2Digit.svg" },
            { value: "TN2", label: "Tennessee (secondary)", asset: "img/shields/United States/TN2-2Digit.svg" },
          ],
        },

        {
          id: "us-texas",
          label: "Texas",
          children: [
            { value: "TX", label: "Texas", asset: "img/shields/United States/TX/TX-2Digit.svg" },
            { value: "TXFM", label: "TX FM", asset: "img/shields/United States/TX/TXFM-4Digit.svg" },
            { value: "TXRM", label: "TX RM", asset: "img/shields/United States/TX/TXRM-2Digit.svg" },
            { value: "TXBELT", label: "TX Beltway", asset: "img/shields/United States/TX/TXBELTWAY-2Digit.svg" },
            { value: "TXLOOP", label: "TX Loop", asset: "img/shields/United States/TX/TXLOOP-2Digit.svg" },
            { value: "TXPARK", label: "TX Park Road", asset: "img/shields/United States/TX/TXPARK-2Digit.svg" },
            { value: "TXSPUR", label: "TX Spur", asset: "img/shields/United States/TX/TXSPUR-2Digit.svg" },
            { value: "TXEXPRESS", label: "TX Express Toll", asset: "img/shields/United States/TX/TXEXPRESS-2Digit.svg" },
            { value: "TXTOLL", label: "TX Toll TxDOT", asset: "img/shields/United States/TX/TXTOLL-2Digit.svg" },
            { value: "TXTOLLCTRMA", label: "TX Toll CTRMA", asset: "img/shields/United States/TX/TXTollCTRMA.svg" },
            { value: "TXTOLLNTTA", label: "TX Toll NTTA", asset: "img/shields/United States/TX/TXTollNTTA.svg" },
            { value: "TXTOLLFBTR", label: "Fort Bend Toll Road", asset: "img/shields/United States/TX/TXTollFBTR.png" },
            { value: "HTR", label: "Hardy Toll Road", asset: "img/shields/United States/TX/HTR.png" },
            { value: "SHT", label: "Sam Houston Tollway", asset: "img/shields/United States/TX/SHT.png" },
            { value: "WPT", label: "Westpark Tollway", asset: "img/shields/United States/TX/WPT.png" },
          ],
        },

        { value: "UT", label: "Utah", asset: "img/shields/United States/UT-2Digit.svg" },

        {
          id: "us-vermont",
          label: "Vermont",
          children: [
            { value: "VT", label: "Vermont", asset: "img/shields/United States/VT-2Digit.svg" },
            { value: "VT2", label: "Vermont (secondary)", asset: "img/shields/United States/VT2-2Digit.svg" },
          ],
        },

        {
          id: "us-virginia",
          label: "Virginia",
          children: [
            { value: "VA", label: "Virginia", asset: "img/shields/United States/VA-2Digit.svg" },
            { value: "VA2", label: "Virginia (secondary)", asset: "img/shields/United States/VA2-2Digit.svg" },
          ],
        },

        { value: "WA", label: "Washington", asset: "img/shields/United States/WA-2Digit.svg" },
        { value: "WV", label: "West Virginia", asset: "img/shields/United States/WV-2Digit.svg" },
        { value: "WI", label: "Wisconsin", asset: "img/shields/United States/WI-2Digit.svg" },
        { value: "WY", label: "Wyoming", asset: "img/shields/United States/WY-2Digit.svg" },
      ],
    },

    {
      id: "canada",
      label: "Canada",
      children: [
        {
          value: "TCH",
          label: "Trans-Canada Highway",
          asset: "img/shields/Canada/TCH-2Digit.svg",
        },
        {
          value: "TCHLeaf",
          label: "TCH Leaf",
          asset: "img/shields/Canada/TCHLeaf-2Digit.svg",
        },

        {
          id: "canada-alberta",
          label: "Alberta",
          children: [
            { value: "AB", label: "Alberta", asset: "img/shields/Canada/AB/AB-2Digit.svg" },
            { value: "AB2", label: "Alberta Secondary", asset: "img/shields/Canada/AB/AB2-2Digit.svg" },
            { value: "ABTC", label: "Alberta TCH", asset: "img/shields/Canada/AB/ABTC-2Digit.svg" },
          ],
        },

        {
          id: "canada-britishcolumbia",
          label: "British Columbia",
          children: [
            { value: "BC", label: "British Columbia", asset: "img/shields/Canada/BC/BC-2Digit.svg" },
            { value: "BCYH", label: "BC Yellowhead", asset: "img/shields/Canada/BC/BCYH-2Digit.svg" },
            { value: "BCTC", label: "BC TCH", asset: "img/shields/Canada/BC/BCTC-2Digit.svg" },
          ],
        },

        {
          id: "canada-manitoba",
          label: "Manitoba",
          children: [
            { value: "MB", label: "Manitoba", asset: "img/shields/Canada/MB/MB-2Digit.svg" },
            { value: "MB2", label: "Manitoba Secondary", asset: "img/shields/Canada/MB/MB2-2Digit.svg" },
            { value: "MBTC", label: "Manitoba TCH", asset: "img/shields/Canada/MB/MBTC-2Digit.svg" },
          ],
        },

        {
          id: "canada-newbrunswick",
          label: "New Brunswick",
          children: [
            { value: "NB", label: "New Brunswick", asset: "img/shields/Canada/NB/NB-2Digit.svg" },
            { value: "NBCONN", label: "NB Connector", asset: "img/shields/Canada/NB/NBCONN-2Digit.svg" },
            { value: "NBLOCAL", label: "NB Local", asset: "img/shields/Canada/NB/NBLOCAL-2Digit.svg" },
            { value: "NBTC", label: "NB TCH", asset: "img/shields/Canada/NB/NBTC-2Digit.svg" },
          ],
        },

        {
          id: "canada-newfoundland",
          label: "Newfoundland and Labrador",
          children: [
            { value: "NL", label: "Newfoundland and Labrador", asset: "img/shields/Canada/NL/NL-2Digit.svg" },
            { value: "NLTC", label: "NL TCH", asset: "img/shields/Canada/NL/NLTC-2Digit.svg" },
          ],
        },

        {
          id: "canada-novascotia",
          label: "Nova Scotia",
          children: [
            { value: "NS", label: "Nova Scotia", asset: "img/shields/Canada/NS/NS-2Digit.svg" },
            { value: "NSCONN", label: "NS Connector", asset: "img/shields/Canada/NS/NSCONN-2Digit.svg" },
            { value: "NSTC", label: "NS TCH", asset: "img/shields/Canada/NS/NSTC-2Digit.svg" },
          ],
        },

        {
          id: "canada-ontario",
          label: "Ontario",
          children: [
            { value: "ON", label: "Ontario", asset: "img/shields/Canada/ON/ON-2Digit.svg" },
            { value: "ON2", label: "Ontario Secondary", asset: "img/shields/Canada/ON/ON2-2Digit.svg" },
            { value: "ON3", label: "Ontario County", asset: "img/shields/Canada/ON/ON3-2Digit.svg" },
            { value: "ONDVP", label: "Don Valley Parkway", asset: "img/shields/Canada/ON/ON-DVP.png" },
            { value: "ONGAR", label: "Gardiner Expressway", asset: "img/shields/Canada/ON/ON-GAR.png" },
            { value: "ONTC", label: "Ontario TCH", asset: "img/shields/Canada/ON/ONTC-2Digit.svg" },
            { value: "ONTCCOR", label: "Central Ontario Route", asset: "img/shields/Canada/ON/ONTC-COR.svg" },
            { value: "ONTCGBR", label: "Georgian Bay Route", asset: "img/shields/Canada/ON/ONTC-GBR.svg" },
            { value: "ONTCLSR", label: "Lake Superior Route", asset: "img/shields/Canada/ON/ONTC-LSR.svg" },
            { value: "ONTCNOR", label: "Northern Ontario Route", asset: "img/shields/Canada/ON/ONTC-NOR.svg" },
            { value: "ONTCOVR", label: "Ottawa Valley Route", asset: "img/shields/Canada/ON/ONTC-OVR.svg" },
          ],
        },

        {
          value: "PEI",
          label: "Prince Edward Island",
          asset: "img/shields/Canada/PEI/PEI-2Digit.svg",
        },

        {
          id: "canada-quebec",
          label: "Quebec",
          children: [
            { value: "QC", label: "Quebec Autoroute", asset: "img/shields/Canada/QC/QC-2Digit.svg" },
            { value: "QC2", label: "Quebec Route", asset: "img/shields/Canada/QC/QC2-2Digit.svg" },
            { value: "QCTC", label: "Quebec TCH", asset: "img/shields/Canada/QC/QCTC-2Digit.svg" },
          ],
        },

        {
          id: "canada-saskatchewan",
          label: "Saskatchewan",
          children: [
            { value: "SK", label: "Saskatchewan", asset: "img/shields/Canada/SK/SK-2Digit.svg" },
            { value: "SK2", label: "SK Secondary", asset: "img/shields/Canada/SK/SK2-2Digit.svg" },
            { value: "SKTC", label: "SK TCH", asset: "img/shields/Canada/SK/SKTC-2Digit.svg" },
          ],
        },
      ],
    },
    {
      id: "australia",
      label: "Australia",
      children: [
        {
          value: "ALPHANUM",
          label: "Alphanumeric",
          asset: "img/shields/Australia/THUMBS/ALPHANUM_thumb.svg",
        },
        {
          value: "NAT",
          label: "National Route",
          asset: "img/shields/Australia/NAT-1Digit.svg",
        },
        {
          value: "NR",
          label: "National Route",
          asset: "img/shields/Australia/NR-2Digit.svg",
        },
        {
          value: "SR",
          label: "State Route",
          asset: "img/shields/Australia/SR-2Digit.svg",
        },
        {
          value: "MR",
          label: "Metroad",
          asset: "img/shields/Australia/MR-2Digit.svg",
        },
        {
          value: "TOLLBLUE",
          label: "Tollway (blue)",
          asset: "img/shields/Australia/THUMBS/TOLL.svg",
        },
        {
          value: "TD",
          label: "Tourist Drive",
          asset: "img/shields/Australia/TD-3Digit.svg",
        },
        {
          value: "FNSW",
          label: "Freeway - NSW (Retired)",
          asset: "img/shields/Australia/FNSW-2Digit.svg",
        },
      ],
    },
    {
      id: "nz",
      label: "New Zealand",
      children: [
        {
          value: "SH",
          label: "State Highway",
          asset: "img/shields/New Zealand/SH-1Digit.svg",
        },
      ],
    },
  ];

  const patchShieldPickerTreeForUploadedStateFolders = () => {
    const usRoot = SHIELD_PICKER_TREE.find((node) => node.id === "us");
    if (!usRoot || !Array.isArray(usRoot.children)) {
      return;
    }

      const replacementIds = new Set([
        "us-interstate",
        "us-usroute",
        "us-arizona",
        "us-florida",
        "us-georgia",
        "us-indiana",
        "us-kansas",
        "us-kentucky",
        "us-massachusetts",
        "us-maine",
        "us-minnesota",
        "us-nevada",
        "us-nebraska",
        "us-wisconsin",
      ]);

    const replacementValues = new Set([
      "I",
      "I-BUS",
      "I-BS",
      "I-BL",
      "I-DS",
      "I-DL",
      "I-F",
      "US",
      "USCA",
      "US-CA",
      "C",
      "WI",
      "WICo",
      "WICO",
      "AZ",
      "AZLOOP",
      "AZ-LOOP",
      "FL",
      "FLToll",
      "FLCFX",
      "FLTP",
      "GA",
      "GAALT",
      "GABYP",
      "GACONN",
      "GALOOP",
      "GASPUR",
      "IN",
      "INTR",
      "IN-TOLLROAD",
      "KS",
      "KSTP",
      "KS-TURNPIKE",
      "KY",
      "KYAA",
      "KYAU",
      "KYBG",
      "KYCM",
      "KYHR",
      "KYMT",
      "KYPR",
      "KYPU",
      "KYWK",
      "KYWN",
      "KY-AA",
      "KY-AUDUBON",
      "KY-BLUEGRASS",
      "KY-HALROGERS",
      "KY-MOUNTAIN",
      "KY-NATCHER",
      "KY-PENNYRILE",
      "KY-PURCHASE",
      "KY-WESTERN",
      "MA",
      "MATP",
      "MA-PIKE",
      "ME",
      "METP",
      "ME-TURNPIKE",
      "MN",
      "MNBUS",
      "MNCo",
      "MN-BUSINESS",
      "NV",
      "NVCC",
      "NE",
      "NELINK",
      "NE-LINK",
      "NESPUR",
      "NE-SPUR",
    ]);

    const shouldRemoveNode = (node) => {
      if (!node) {
        return false;
      }

      if (replacementIds.has(node.id)) {
        return true;
      }

      if (node.value && replacementValues.has(node.value)) {
        return true;
      }

      return false;
    };

    usRoot.children = usRoot.children.filter((node) => !shouldRemoveNode(node));

    const node = (value, label, asset) => ({
      value,
      label,
      asset,
    });

    const category = (id, label, children) => ({
      id,
      label,
      children,
    });

    const stateFolders = [
        category("us-interstate", "Interstate", [
          node("I", "Interstate", "img/shields/United States/Interstate/I-2Digit.svg"),
          node("I-BUS", "Interstate Business", "img/shields/United States/Interstate/I-BUS-2Digit.svg"),
          node("I-BL", "Interstate Business Loop", "img/shields/United States/Interstate/I-BL-2Digit.svg"),
          node("I-BS", "Interstate Business Spur", "img/shields/United States/Interstate/I-BS-2Digit.svg"),
          node("I-DL", "Interstate Downtown Loop", "img/shields/United States/Interstate/I-DL-2Digit.svg"),
          node("I-DS", "Interstate Downtown Spur", "img/shields/United States/Interstate/I-DS-2Digit.svg"),
          node("I-F", "Future Interstate", "img/shields/United States/Interstate/I-F-2Digit.svg"),
        ]),
        category("us-usroute", "U.S. Route", [
          node("US", "U.S. Route", "img/shields/United States/US Route/US-2Digit.svg"),
          node("USCA", "U.S. Route (CA style)", "img/shields/United States/US Route/US-CA-2Digit.svg"),
        ]),
      category("us-arizona", "Arizona", [
        node("AZ", "Arizona", "img/shields/United States/AZ/AZ-2Digit.svg"),
        node("AZLOOP", "Arizona Loop", "img/shields/United States/AZ/AZLOOP-2Digit.svg"),
      ]),

      category("us-florida", "Florida", [
        node(
          "FL",
          "Florida",
          "img/shields/United States/Florida/FDOT/FL-36-2Digit.svg"
        ),
        node(
          "FLToll",
          "FDOT Toll",
          "img/shields/United States/Florida/FDOT/TollFDOT-48.svg"
        ),
        node(
          "FLCFX",
          "CFX Toll",
          "img/shields/United States/Florida/CFX/CFX-48.svg"
        ),
        node(
          "FLTP",
          "Florida's Turnpike",
          "img/shields/United States/Florida/FDOT/FLTP-48.svg"
        ),
      ]),

      category("us-georgia", "Georgia", [
        node("GA", "Georgia", "img/shields/United States/GA/GA-2Digit.svg"),
        node("GAALT", "GA Alternate", "img/shields/United States/GA/GAALT-2Digit.svg"),
        node("GABYP", "GA Bypass", "img/shields/United States/GA/GABYP-2Digit.svg"),
        node("GACONN", "GA Connector", "img/shields/United States/GA/GACONN-2Digit.svg"),
        node("GALOOP", "GA Loop", "img/shields/United States/GA/GALOOP-2Digit.svg"),
        node("GASPUR", "GA Spur", "img/shields/United States/GA/GASPUR-2Digit.svg"),
      ]),

      category("us-indiana", "Indiana", [
        node("IN", "Indiana", "img/shields/United States/IN/IN-2Digit.svg"),
        node("INTR", "Indiana Toll Road", "img/shields/United States/IN/INTR.png"),
      ]),

      category("us-kansas", "Kansas", [
        node("KS", "Kansas", "img/shields/United States/KS/KS-2Digit.svg"),
        node("KSTP", "Kansas Turnpike", "img/shields/United States/KS/KSTP.png"),
      ]),

      category("us-kentucky", "Kentucky", [
        node("KY", "Kentucky", "img/shields/United States/KY/KY-2Digit.svg"),
        category("us-kentucky-parkways", "KY Parkways", [
          node("KYAA", "AA Highway", "img/shields/United States/KY/KYAA.png"),
          node("KYAU", "Audubon Parkway", "img/shields/United States/KY/KYAU.png"),
          node("KYBG", "Bluegrass Parkway", "img/shields/United States/KY/KYBG.png"),
          node("KYCM", "Cumberland Parkway", "img/shields/United States/KY/KYCM.png"),
          node("KYHR", "Hal Rogers Parkway", "img/shields/United States/KY/KYHR.png"),
          node("KYMT", "Mountain Parkway", "img/shields/United States/KY/KYMT.png"),
          node("KYPR", "Pennyrile Parkway", "img/shields/United States/KY/KYPR.png"),
          node("KYPU", "Purchase Parkway", "img/shields/United States/KY/KYPU.png"),
          node("KYWK", "Western KY Parkway", "img/shields/United States/KY/KYWK.png"),
          node("KYWN", "Natcher Parkway", "img/shields/United States/KY/KYWN.png"),
        ]),
      ]),

      category("us-maine", "Maine", [
        node("ME", "Maine", "img/shields/United States/ME/ME-2Digit.svg"),
        node("METP", "Maine Turnpike", "img/shields/United States/ME/METP.png"),
      ]),

      category("us-massachusetts", "Massachusetts", [
        node("MA", "Massachusetts", "img/shields/United States/MA/MA-2Digit.svg"),
        node("MATP", "Mass Pike", "img/shields/United States/MA/MATP.png"),
      ]),

      category("us-minnesota", "Minnesota", [
        node("MN", "Minnesota", "img/shields/United States/MN/MN-2Digit.svg"),
        node("MNBUS", "Minnesota Business", "img/shields/United States/MN/MNBUS-2Digit.svg"),
        node("MNCo", "Minnesota County", "img/shields/United States/MN/MNCo-2Digit.svg"),
      ]),

      category("us-nevada", "Nevada", [
        node("NV", "Nevada", "img/shields/United States/NV/NV-2Digit.svg"),
        node("NVCC", "Clark County", "img/shields/United States/NV/NVCC-2Digit.svg"),
      ]),

      category("us-nebraska", "Nebraska", [
        node("NE", "Nebraska", "img/shields/United States/NE/NE-2Digit.svg"),
        node("NELINK", "Nebraska Link", "img/shields/United States/NE/NELINK-2Digit.svg"),
        node("NESPUR", "Nebraska Spur", "img/shields/United States/NE/NESPUR-2Digit.svg"),
      ]),

      category("us-wisconsin", "Wisconsin", [
        node("WI", "Wisconsin", "img/shields/United States/WI/WI-2Digit.svg"),
        node("WICo", "Wisconsin County", "img/shields/United States/WI/WICo-2Digit.svg"),
      ]),



    ];

      const countyNode = node(
        "C",
        "County",
        "img/shields/United States/C-2Digit.svg"
      );

      const sortUnitedStatesShieldPickerChildren = () => {
        const getPriority = (entry) => {
          if (entry.id === "us-interstate" || entry.label === "Interstate") {
            return 0;
          }

            if (entry.id === "us-usroute" || entry.label === "U.S. Route") {
              return 1;
            }

            if (entry.value === "C" || entry.label === "County") {
              return 2;
            }

            return 3;
        };

        const sortNodes = (nodes) => {
          if (!Array.isArray(nodes)) {
            return;
          }

          nodes.sort((a, b) => {
            const priorityA = getPriority(a);
            const priorityB = getPriority(b);

            if (priorityA !== priorityB) {
              return priorityA - priorityB;
            }

            return String(a.label || a.value || "").localeCompare(
              String(b.label || b.value || "")
            );
          });

          nodes.forEach((node) => {
            if (Array.isArray(node.children)) {
              sortNodes(node.children);
            }
          });
        };

        sortNodes(usRoot.children);
      };

    const insertIndex = usRoot.children.findIndex((entry) => {
      const label = entry.label || "";
      return label.localeCompare("Arizona") > 0;
    });

    if (insertIndex === -1) {
      usRoot.children.push(...stateFolders);
    } else {
      usRoot.children.splice(insertIndex, 0, ...stateFolders);
    }
    if (!usRoot.children.some((entry) => entry.value === "C")) {
      usRoot.children.push(countyNode);
    }
      sortUnitedStatesShieldPickerChildren();
  };

  patchShieldPickerTreeForUploadedStateFolders();


  const flattenShieldPickerTree = (nodes, result = []) => {
    nodes.forEach((node) => {
      if (node.value) {
        result.push(node);
      }
      if (Array.isArray(node.children)) {
        flattenShieldPickerTree(node.children, result);
      }
    });
    return result;
  };

  const findShieldPickerEntryByValue = (value, nodes = SHIELD_PICKER_TREE) => {
    for (const node of nodes) {
      if (node.value === value) {
        return node;
      }
      if (Array.isArray(node.children)) {
        const found = findShieldPickerEntryByValue(value, node.children);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const findFirstSelectableShieldEntry = (nodes = []) => {
    for (const node of nodes) {
      if (!node.disabled && node.value) {
        return node;
      }
      if (Array.isArray(node.children) && node.children.length) {
        const found = findFirstSelectableShieldEntry(node.children);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const buildShieldPickerTriggerLabel = (entry) => {
    if (!entry) {
      return "Select shield";
    }
    return entry.label;
  };

  const setShieldPickerButtonIcon = (
    image,
    requestedPath,
    finalFallback = SHIELD_DROPDOWN_PLACEHOLDER_ICON
  ) => {
    if (!image) {
      return;
    }

    const requested = String(requestedPath || "").trim();
    const bundledFallback =
      requested &&
      typeof window.getSignMakerAssetFallback === "function"
        ? window.getSignMakerAssetFallback(requested)
        : null;

    image.onerror = null;

    if (bundledFallback) {
      // Keep the button from flashing the generic placeholder while the
      // renamed local asset is being checked.
      image.src = bundledFallback;

      if (requested && !requested.startsWith("data:")) {
        const probe = new Image();
        probe.onload = () => {
          image.src = requested;
          if (typeof window.applySignMakerAssetFallback === "function") {
            window.applySignMakerAssetFallback(
              image,
              requested,
              finalFallback
            );
          }
        };
        probe.src = requested;
      }

      return;
    }

    image.src = requested || finalFallback;

    if (typeof window.applySignMakerAssetFallback === "function") {
      window.applySignMakerAssetFallback(
        image,
        requested || image.src,
        finalFallback
      );
    } else {
      image.onerror = () => {
        image.onerror = null;
        image.src = finalFallback;
      };
    }
  };

  const buildShieldPickerIconSrc = (entry) => {
    const resolveAsset = (path) =>
      typeof window.resolveSignMakerAsset === "function"
        ? window.resolveSignMakerAsset(path)
        : path;

    if (!entry) {
      return SHIELD_DROPDOWN_PLACEHOLDER_ICON;
    }

    if (entry.asset) {
      return resolveAsset(entry.asset);
    }

    if (Array.isArray(entry.children) && entry.children.length) {
      const firstChildShield = findFirstSelectableShieldEntry(entry.children);
      if (firstChildShield && firstChildShield.asset) {
        return resolveAsset(firstChildShield.asset);
      }
    }

    return SHIELD_DROPDOWN_PLACEHOLDER_ICON;
  };

  const updateShieldPickerTreeState = (container, currentValue, expandedIds) => {
    container.querySelectorAll(".shieldPickerTreeRow").forEach((row) => {
      const nodeId = row.dataset.nodeId || "";
      row.classList.toggle("expanded", !!nodeId && expandedIds.has(nodeId));
    });

    container.querySelectorAll(".shieldPickerItem").forEach((button) => {
      const nodeId = button.dataset.nodeId || "";
      const nodeValue = button.dataset.nodeValue || "";
      const hasChildren = button.dataset.hasChildren === "true";
      const isExpanded = hasChildren && expandedIds.has(nodeId);

      button.classList.toggle("expanded", isExpanded);
      button.classList.toggle(
        "selected",
        !!nodeValue && nodeValue === currentValue
      );
    });

    container.querySelectorAll(".shieldPickerTreeChildren").forEach((children) => {
      const parentId = children.dataset.parentId || "";
      children.classList.toggle("expanded", !!parentId && expandedIds.has(parentId));
    });
  };


  const createShieldPickerRow = ({
    node,
    depth = 0,
    currentValue,
    expandedIds,
    onSelect,
    onToggle,
    onEdit,
  }) => {
    const row = document.createElement("div");
    row.className = "shieldPickerTreeRow";
    row.style.setProperty("--shieldPickerDepth", String(depth));
    row.dataset.nodeId = node.id || "";
    if (node.customSavedShield) {
      row.classList.add("customShieldPickerSavedRow");
    }

    const isExpanded =
      !!(node.children && node.children.length && expandedIds.has(node.id));

    if (isExpanded) {
      row.classList.add("expanded");
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "shieldPickerItem";
    button.dataset.nodeId = node.id || "";
    button.dataset.nodeValue = node.value || "";
    button.dataset.hasChildren =
      node.children && node.children.length ? "true" : "false";

    if (node.value && node.value === currentValue) {
      button.classList.add("selected");
    }
    if (node.disabled) {
      button.classList.add("disabled");
    }
    if (node.children && node.children.length) {
      button.classList.add("hasChildren");
    }
    if (isExpanded) {
      button.classList.add("expanded");
    }

    const icon = document.createElement("img");
    icon.className = "shieldPickerItemIcon";
    icon.src = buildShieldPickerIconSrc(node);
    icon.alt = "";
    icon.loading = "lazy";
    icon.decoding = "async";
    icon.draggable = false;
    if (typeof window.applySignMakerAssetFallback === "function") {
      window.applySignMakerAssetFallback(
        icon,
        icon.getAttribute("src") || icon.src,
        SHIELD_DROPDOWN_PLACEHOLDER_ICON
      );
    } else {
      icon.onerror = () => {
        icon.src = SHIELD_DROPDOWN_PLACEHOLDER_ICON;
      };
    }
    button.appendChild(icon);

    const label = document.createElement("span");
    label.className = "shieldPickerItemLabel";
    label.textContent = node.label;
    button.appendChild(label);

    if (node.children && node.children.length) {
      const caret = document.createElement("span");
      caret.className = "shieldPickerItemCaret";
      caret.setAttribute("aria-hidden", "true");
      button.appendChild(caret);
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (node.children && node.children.length) {
        const wasExpanded = expandedIds.has(node.id);

        onToggle(node.id);

        if (!wasExpanded) {
          const firstChildShield = findFirstSelectableShieldEntry(node.children);
          if (firstChildShield) {
            onSelect(firstChildShield, {
              keepOpen: true,
              skipExpandPath: false,
              preserveTree: true,
            });
          }
        }

        return;
      }

      if (!node.disabled && node.value) {
        onSelect(node);
      }
    });

    row.appendChild(button);

    if (node.customSavedShield) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "shieldPickerEditCustomShield";
      editButton.title = "Edit custom shield";
      editButton.setAttribute("aria-label", `Edit ${node.label || "custom shield"}`);
      editButton.innerHTML = `<span class="material-symbols-outlined">edit</span>`;
      editButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onEdit === "function") {
          onEdit(node);
        }
      });
      row.appendChild(editButton);
    }

    if (node.children && node.children.length) {
      const childrenWrap = document.createElement("div");
      childrenWrap.className = "shieldPickerTreeChildren";
      childrenWrap.dataset.parentId = node.id || "";

      if (isExpanded) {
        childrenWrap.classList.add("expanded");
      }

      node.children.forEach((child) => {
        childrenWrap.appendChild(
          createShieldPickerRow({
            node: child,
            depth: depth + 1,
            currentValue,
            expandedIds,
            onSelect,
            onToggle,
            onEdit,
          })
        );
      });

      row.appendChild(childrenWrap);
    }

    return row;
  };

  const renderShieldPickerTree = ({
    container,
    nodes,
    currentValue,
    expandedIds,
    onSelect,
    onToggle,
    onEdit,
  }) => {
    container.innerHTML = "";

    nodes.forEach((node) => {
      container.appendChild(
        createShieldPickerRow({
          node,
          depth: 0,
          currentValue,
          expandedIds,
          onSelect,
          onToggle,
          onEdit,
        })
      );
    });
  };

  const fitShieldPickerTriggerLabelText = (trigger, label) => {
    if (!trigger || !label) {
      return;
    }

    label.style.removeProperty("font-family");
    label.style.removeProperty("font-size");
    label.style.setProperty("white-space", "nowrap", "important");

    const availableWidth = label.clientWidth;
    if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
      return;
    }

    const initialStyle = window.getComputedStyle(label);
    const initialFontSize = parseFloat(initialStyle.fontSize) || 14;

    const fits = () => label.scrollWidth <= label.clientWidth + 0.5;

    if (fits()) {
      return;
    }

    label.style.setProperty(
      "font-family",
      '"Inter Tight", "Inter", sans-serif',
      "important"
    );
    if (fits()) {
      return;
    }

    const minimumFontSize = Math.min(initialFontSize, 7);
    let low = minimumFontSize;
    let high = initialFontSize;
    let best = minimumFontSize;

    label.style.setProperty("font-size", `${minimumFontSize}px`, "important");
    if (!fits()) {
      return;
    }

    for (let i = 0; i < 12; i += 1) {
      const midpoint = (low + high) / 2;
      label.style.setProperty("font-size", `${midpoint}px`, "important");

      if (fits()) {
        best = midpoint;
        low = midpoint;
      } else {
        high = midpoint;
      }
    }

    label.style.setProperty("font-size", `${best}px`, "important");
  };

  const createShieldPicker = ({
    mount,
    value,
    onChange,
    placeholder = "Select shield",
    rootNodes = SHIELD_PICKER_TREE,
  }) => {
    const wrapper = document.createElement("div");
    wrapper.className = "shieldPicker";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "shieldPickerTrigger";

    const triggerIcon = document.createElement("img");
    triggerIcon.className = "shieldPickerTriggerIcon";
    triggerIcon.alt = "";
    trigger.appendChild(triggerIcon);

    const triggerLabel = document.createElement("span");
    triggerLabel.className = "shieldPickerTriggerLabel";
    trigger.appendChild(triggerLabel);

    const triggerCaret = document.createElement("span");
    triggerCaret.className = "shieldPickerTriggerCaret";
    triggerCaret.textContent = "keyboard_arrow_down";
    trigger.appendChild(triggerCaret);

      const popover = document.createElement("div");
      popover.className = "shieldPickerPopover";

      const getStoredShieldPickerScrollTop = () => {
        const raw = readStoredScrollTop();
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      };

      const saveShieldPickerScrollTop = () => {
        writeStoredScrollTop(String(Math.max(0, popover.scrollTop || 0)));
      };

      const restoreShieldPickerScrollTop = () => {
        const storedScrollTop = getStoredShieldPickerScrollTop();

        if (storedScrollTop !== null) {
          popover.scrollTop = storedScrollTop;
          return;
        }

        const selectedItem = popover.querySelector(".shieldPickerItem.selected");
        if (selectedItem) {
          selectedItem.scrollIntoView({
            block: "nearest",
            inline: "nearest",
          });
        }
      };

      const placePopover = () => {
        const rect = trigger.getBoundingClientRect();

        const visualScale =
          parseFloat(
            getComputedStyle(document.documentElement)
              .getPropertyValue("--sm-app-zoom")
          ) || 1;

        const viewportHeight = window.innerHeight;
        const bottomSpace = viewportHeight - rect.bottom - 12;
        const topSpace = rect.top - 12;
        const openUpward = bottomSpace < 220 && topSpace > bottomSpace;

        // The popover lives on <body> and is scaled like the editor windows.
        popover.style.position = "fixed";
        popover.style.left = rect.left + "px";
        popover.style.width = Math.max(rect.width / visualScale, 320) + "px";
        popover.style.transformOrigin = openUpward ? "bottom left" : "top left";

        if (openUpward) {
          popover.style.top = "auto";
          popover.style.bottom = viewportHeight - rect.top + 2 + "px";
          popover.style.maxHeight =
            Math.max(260, Math.min(760, topSpace / visualScale)) + "px";
        } else {
          popover.style.bottom = "auto";
          popover.style.top = rect.bottom + 2 + "px";
          popover.style.maxHeight =
            Math.max(260, Math.min(760, bottomSpace / visualScale)) + "px";
        }
      };;

    const tree = document.createElement("div");
    tree.className = "shieldPickerTree";
    popover.appendChild(tree);

    wrapper.appendChild(trigger);
    document.body.appendChild(popover);
    mount.replaceWith(wrapper);
    // The popover sits outside the wrapper, so it mirrors the wrapper's open state.
    new MutationObserver(() => {
      popover.classList.toggle("open", wrapper.classList.contains("open"));
    }).observe(wrapper, { attributes: true, attributeFilter: ["class"] });

    let currentValue = value || "";
    const expandedIds = new Set(["us", "canada"]);

    const expandPathToValue = (targetValue, nodes = rootNodes, parents = []) => {
      for (const node of nodes) {
        if (node.value === targetValue) {
          parents.forEach((id) => expandedIds.add(id));
          return true;
        }
        if (Array.isArray(node.children)) {
          if (expandPathToValue(targetValue, node.children, [...parents, node.id])) {
            return true;
          }
        }
      }
      return false;
    };

    const syncTrigger = () => {
      const entry = findShieldPickerEntryByValue(currentValue, rootNodes);
      triggerLabel.textContent = entry
        ? buildShieldPickerTriggerLabel(entry)
        : placeholder;
      const triggerIconPath = buildShieldPickerIconSrc(entry);
      setShieldPickerButtonIcon(
        triggerIcon,
        triggerIconPath,
        SHIELD_DROPDOWN_PLACEHOLDER_ICON
      );
      fitShieldPickerTriggerLabelText(trigger, triggerLabel);
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() =>
          fitShieldPickerTriggerLabelText(trigger, triggerLabel)
        );
      }
    };

    const openCustomShieldMakerFromPicker = () => {
      if (typeof api.openCustomShieldMaker === "function") {
        api.openCustomShieldMaker(currentValue);
      }
    };

    const rerenderTree = (forceRebuild = false) => {
      if (forceRebuild || !tree.childElementCount) {
        renderShieldPickerTree({
          container: tree,
          nodes: rootNodes,
          currentValue,
          expandedIds,
          onSelect: (node, options = {}) => {
            if (
              node.customShieldMaker ||
              node.value === SHIELD_PICKER_CUSTOM_MAKER_VALUE
            ) {
              saveShieldPickerScrollTop();
              wrapper.classList.remove("open");
              openCustomShieldMakerFromPicker();
              return;
            }

            currentValue = node.value;

            if (!options.skipExpandPath) {
              expandPathToValue(node.value);
            }

              syncTrigger();

              if (options.preserveTree) {
                updateShieldPickerTreeState(tree, currentValue, expandedIds);
              } else {
                rerenderTree(true);
              }

                if (!options.keepOpen) {
                  saveShieldPickerScrollTop();
                  wrapper.classList.remove("open");
                }

              if (typeof onChange === "function") {
                onChange(node.value, node);
              }
            },
            onToggle: (id) => {
              if (expandedIds.has(id)) {
                expandedIds.delete(id);
              } else {
                expandedIds.add(id);
              }

              updateShieldPickerTreeState(tree, currentValue, expandedIds);
            },
            onEdit: (node) => {
              saveShieldPickerScrollTop();
              wrapper.classList.remove("open");
              document
                .querySelectorAll(".shieldPicker.open")
                .forEach((picker) => picker.classList.remove("open"));
              const dialog = document.getElementById("customShieldMaker");
              if (
                dialog &&
                typeof dialog._openSavedCustomShield === "function" &&
                node.customShieldId
              ) {
                dialog._openSavedCustomShield(node.customShieldId);
              }
            },
          });

          return;
        }

        updateShieldPickerTreeState(tree, currentValue, expandedIds);
      };

      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const willOpen = !wrapper.classList.contains("open");

        if (!willOpen) {
          saveShieldPickerScrollTop();
        }

        wrapper.classList.toggle("open", willOpen);

        if (willOpen) {
          placePopover();
          rerenderTree();
          requestAnimationFrame(() => {
            restoreShieldPickerScrollTop();
          });
        }
      });

          document.addEventListener("click", (event) => {
            const clickedInsideTrigger = trigger.contains(event.target);
            const clickedInsidePopover = popover.contains(event.target);

            if (!clickedInsideTrigger && !clickedInsidePopover) {
              if (wrapper.classList.contains("open")) {
                saveShieldPickerScrollTop();
              }

              wrapper.classList.remove("open");
            }
          });

          popover.addEventListener("scroll", () => {
            saveShieldPickerScrollTop();
          });

      window.addEventListener("resize", () => {
        if (wrapper.classList.contains("open")) {
          placePopover();
        }
      });

      window.addEventListener("scroll", () => {
        if (wrapper.classList.contains("open")) {
          placePopover();
        }
      }, true);

      expandPathToValue(currentValue);
      syncTrigger();
      rerenderTree(true);

    const pickerApi = {
      element: wrapper,
      getValue: () => currentValue,
      setValue: (nextValue) => {
        currentValue = nextValue || "";
        expandPathToValue(currentValue);
        syncTrigger();
        rerenderTree(true);
      },
      refresh: () => {
        expandPathToValue(currentValue);
        syncTrigger();
        rerenderTree(true);
      },
    };

    activeShieldPickerApis.add(pickerApi);
    return pickerApi;
  };


  // Florida uses v2.2's FDOT/CFX catalogue and codes.
  const floridaFolder = "img/shields/United States/Florida";
  const findNode = (nodes, predicate) => {
    for (const node of nodes || []) {
      if (predicate(node)) {
        return node;
      }
      const found = findNode(node.children, predicate);
      if (found) {
        return found;
      }
    }
    return null;
  };
  const florida = findNode(SHIELD_PICKER_TREE, (node) => node.id === "us-florida");
  if (florida) {
    florida.children = [
      { value: "FL", label: "Florida", asset: `${floridaFolder}/FDOT/Florida-Guide-42x36-1to2.svg` },
      { value: "FLToll", label: "FDOT Toll", asset: `${floridaFolder}/FDOT/Toll-40x48.svg` },
      { value: "FLCFXToll", label: "CFX Toll", asset: `${floridaFolder}/CFX/CFX-TM-36x48.svg` },
      { value: "FLTURNPIKE", label: "Florida's Turnpike", asset: `${floridaFolder}/FDOT/Turnpike-40x48.svg` },
    ];
  }
  const kentucky = findNode(SHIELD_PICKER_TREE, (node) => node.id === "us-kentucky-parkways");
  kentucky?.children.push({
    value: "KYPKWY",
    label: "Kentucky Parkway (new style)",
    asset: "img/shields/United States/KY/KYPKWY-Audubon.svg",
  });
  const newYork = findNode(SHIELD_PICKER_TREE, (node) => node.id === "us-newyork");
  newYork?.children.push({
    value: "NYPKWY",
    label: "New York Parkway (new style)",
    asset: "img/shields/United States/NY/NYPKWY-Bethpage.svg",
  });
  SHIELD_PICKER_TREE.push({
    id: "dusksmp",
    label: "DuskSMP",
    children: [
      { value: "DUSKSMP", label: "DuskSMP", asset: "img/shields/DuskSMP/DUSKSMP.svg" },
      { value: "DUSKSMP_TOLL", label: "DuskSMP Toll", asset: "img/shields/DuskSMP/DUSKSMP_TOLL.svg" },
    ],
  });

  // Every shield in the catalogue stays selectable, even without a hand-placed entry.
  const listedValues = new Set(flattenShieldPickerTree(SHIELD_PICKER_TREE).map((entry) => entry.value));
  (ShieldElement.prototype.blockShieldBases || []).forEach((shield) => {
    if (listedValues.has(shield.value)) {
      return;
    }
    const [country, region] = shield.categories || [];
    const countryNode =
      SHIELD_PICKER_TREE.find((node) => node.label === country) ||
      SHIELD_PICKER_TREE[SHIELD_PICKER_TREE.length - 1];
    const parent =
      (region && (countryNode.children || []).find((node) => node.children && node.label === region)) ||
      countryNode;
    const firstVariant = shield.variants?.[0];
    parent.children.push({
      value: shield.value,
      label: shield.label,
      asset: ShieldElement.prototype.getShieldAssetPath(
        shield,
        firstVariant ? ShieldElement.prototype.formatVariantKey(firstVariant) : ""
      ),
    });
    listedValues.add(shield.value);
  });

  // The Custom Shield Maker entry appears once something can open it.
  const customShieldMakerNode = (() => ({
        id: "custom-shield-maker",
        value: SHIELD_PICKER_CUSTOM_MAKER_VALUE,
        label: "Custom Shield",
        asset: "img/other-symbols/icon.png",
        customShieldMaker: true,
  }))();
  api.enableCustomShieldMaker = (open) => {
    api.openCustomShieldMaker = open;
    if (!SHIELD_PICKER_TREE.includes(customShieldMakerNode)) {
      SHIELD_PICKER_TREE.unshift(customShieldMakerNode);
    }
    refreshAllShieldPickers();
  };

  Object.assign(api, {
    customMakerValue: SHIELD_PICKER_CUSTOM_MAKER_VALUE,
    tree: SHIELD_PICKER_TREE,
    create: createShieldPicker,
    findEntry: findShieldPickerEntryByValue,
    refreshAll: refreshAllShieldPickers,
  });
  return api;
})();
