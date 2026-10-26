let data;

fetch("./data/rejony.json")
    .then(response => response.json())
    .then(json => {
        data = json;

        loadStreetList();

        console.log("Dane załadowane:", data);
    })
    .catch(error => {
        console.error("Błąd podczas ładowania danych:", error);
    });


function normalizeAddressNumber(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
}


function parseAddressNumber(value) {
    const normalized = normalizeAddressNumber(value);

    const match = normalized.match(/^(\d+)([a-z]*)$/);

    if (!match) {
        return null;
    }

    return {
        full: normalized,
        number: Number(match[1]),
        suffix: match[2]
    };
}


function matchesRule(addressNumber, rule) {

    // Cała ulica
    if (rule.type === "all") {
        return true;
    }


    // Konkretne numery
    if (rule.type === "list") {
        return rule.values
            .map(normalizeAddressNumber)
            .includes(addressNumber.full);
    }


    // Cała ulica poza wyjątkami
    if (rule.type === "allExcept") {

        const excluded = (rule.exclude ?? [])
            .map(normalizeAddressNumber);

        return !excluded.includes(addressNumber.full);
    }


    // Zakres
    if (rule.type === "range") {

        if (addressNumber.number < rule.from) {
            return false;
        }

        if (
            rule.to !== null &&
            addressNumber.number > rule.to
        ) {
            return false;
        }

        if (
            rule.parity === "even" &&
            addressNumber.number % 2 !== 0
        ) {
            return false;
        }

        if (
            rule.parity === "odd" &&
            addressNumber.number % 2 === 0
        ) {
            return false;
        }

        const excluded = (rule.exclude ?? [])
            .map(normalizeAddressNumber);

        if (excluded.includes(addressNumber.full)) {
            return false;
        }

        return true;
    }


    return false;
}


function findRegion(streetName, houseNumber) {

    const street = data.streets.find(
        street =>
            street.street.toLowerCase() ===
            streetName.trim().toLowerCase()
    );

    if (!street) {
        return {
            status: "street-not-found"
        };
    }


    const parsedNumber = parseAddressNumber(houseNumber);

    if (!parsedNumber) {
        return {
            status: "invalid-number"
        };
    }


    const regions = [];

    for (const assignment of street.assignments) {

        const matches = assignment.rules.some(
            rule => matchesRule(parsedNumber, rule)
        );

        if (matches) {
            regions.push(assignment.region);
        }
    }


    if (regions.length === 0) {
        return {
            status: "not-found"
        };
    }


    if (regions.length === 1) {
        return {
            status: "found",
            region: regions[0]
        };
    }


    return {
        status: "conflict",
        regions: regions
    };
}

const searchForm = document.getElementById("searchForm");
const streetInput = document.getElementById("street");
const houseNumberInput = document.getElementById("houseNumber");
const resultElement = document.getElementById("result");
const streetList = document.getElementById("streetList");


function loadStreetList() {

    streetList.innerHTML = "";

    const streets = data.streets
        .map(street => street.street)
        .sort((a, b) => a.localeCompare(b, "pl"));


    for (const street of streets) {

        const option = document.createElement("option");

        option.value = street;

        streetList.appendChild(option);
    }
}


searchForm.addEventListener("submit", event => {

    event.preventDefault();


    const street = streetInput.value;
    const houseNumber = houseNumberInput.value;


    const result = findRegion(
        street,
        houseNumber
    );


    displayResult(result);
});


function displayResult(result) {

    resultElement.className = "result";


    switch (result.status) {

        case "found":

            resultElement.classList.add("success");

            resultElement.innerHTML = `
                <div>Adres należy do:</div>
                <div class="result-region">
                    Rejon ${result.region}
                </div>
            `;

            break;


        case "conflict":

            resultElement.classList.add("warning");

            resultElement.innerHTML = `
                <strong>⚠️ Niejednoznaczne dane</strong>
                <p>
                    Ten adres pasuje do kilku rejonów:
                    ${result.regions.join(", ")}
                </p>
            `;

            break;


        case "street-not-found":

            resultElement.classList.add("error");

            resultElement.innerHTML = `
                <strong>Nie znaleziono ulicy.</strong>
                <p>
                    Sprawdź poprawność nazwy.
                </p>
            `;

            break;


        case "invalid-number":

            resultElement.classList.add("error");

            resultElement.innerHTML = `
                <strong>Nieprawidłowy numer budynku.</strong>
            `;

            break;


        case "not-found":

            resultElement.classList.add("error");

            resultElement.innerHTML = `
                <strong>Nie znaleziono rejonu.</strong>
                <p>
                    Ulica istnieje w bazie, ale podany numer
                    nie pasuje do żadnego rejonu.
                </p>
            `;

            break;
    }
}