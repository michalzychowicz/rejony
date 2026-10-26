let data;

fetch("./data/rejony.json")
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    })
    .then(json => {
        data = json;
        loadStreetList();

        console.log("Dane załadowane:", data);
    })
    .catch(error => {
        console.error("Błąd podczas ładowania danych:", error);

        displayResult({
            status: "data-error"
        });
    });


/* =========================
   NORMALIZACJA
========================= */

function normalizeText(value) {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}


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


/* =========================
   SPRAWDZANIE REGUŁ
========================= */

function matchesParity(number, parity) {

    if (!parity) {
        return true;
    }

    if (parity === "even") {
        return number % 2 === 0;
    }

    if (parity === "odd") {
        return number % 2 !== 0;
    }

    return true;
}


function matchesException(addressNumber, exception) {

    // Pojedynczy numer, np. "20", "10b"
    if (typeof exception === "string") {

        return (
            addressNumber.full ===
            normalizeAddressNumber(exception)
        );
    }


    // Zakres wykluczeń
    if (
        !exception ||
        typeof exception !== "object"
    ) {
        return false;
    }


    if (
        !matchesParity(
            addressNumber.number,
            exception.parity
        )
    ) {
        return false;
    }


    /*
        Zakresy liczbowe dotyczą czystych numerów.

        Czyli zakres 20-30 nie obejmuje automatycznie
        20a, 20b itd.
    */
    if (addressNumber.suffix) {
        return false;
    }


    if (
        addressNumber.number <
        exception.from
    ) {
        return false;
    }


    if (
        exception.to !== null &&
        addressNumber.number >
        exception.to
    ) {
        return false;
    }


    return true;
}


function isExcluded(addressNumber, exclude = []) {

    return exclude.some(
        exception =>
            matchesException(
                addressNumber,
                exception
            )
    );
}


function matchesRule(addressNumber, rule) {

    /*
        CAŁA ULICA
    */

    if (rule.type === "all") {

        return !isExcluded(
            addressNumber,
            rule.exclude
        );
    }


    /*
        LISTA KONKRETNYCH NUMERÓW
    */

    if (rule.type === "list") {

        const matches = rule.values
            .map(normalizeAddressNumber)
            .includes(addressNumber.full);


        if (!matches) {
            return false;
        }


        return !isExcluded(
            addressNumber,
            rule.exclude
        );
    }


    /*
        CAŁA ULICA POZA WYJĄTKAMI
    */

    if (rule.type === "allExcept") {

        return !isExcluded(
            addressNumber,
            rule.exclude
        );
    }


    /*
        ZAKRES
    */

    if (rule.type === "range") {

        /*
            Zakres numeryczny nie obejmuje
            automatycznie numerów z literą.

            np. 20-30 nie oznacza 20a.
        */

        if (addressNumber.suffix) {
            return false;
        }


        if (
            addressNumber.number <
            rule.from
        ) {
            return false;
        }


        if (
            rule.to !== null &&
            addressNumber.number >
            rule.to
        ) {
            return false;
        }


        if (
            !matchesParity(
                addressNumber.number,
                rule.parity
            )
        ) {
            return false;
        }


        if (
            isExcluded(
                addressNumber,
                rule.exclude
            )
        ) {
            return false;
        }


        return true;
    }


    return false;
}


/* =========================
   WYSZUKIWANIE REJONU
========================= */

function findRegion(
    streetName,
    houseNumber
) {

    const street = data.streets.find(
        item =>
            normalizeText(item.street) ===
            normalizeText(streetName)
    );


    if (!street) {

        return {
            status: "street-not-found"
        };
    }


    const parsedNumber =
        parseAddressNumber(houseNumber);


    if (!parsedNumber) {

        return {
            status: "invalid-number"
        };
    }


    const matches = [];


    for (
        const assignment
        of street.assignments
    ) {

        const matchesAssignment =
            assignment.rules.some(
                rule =>
                    matchesRule(
                        parsedNumber,
                        rule
                    )
            );


        if (matchesAssignment) {

            matches.push({
                region: assignment.region,
                verified: assignment.verified,
                sourceRule:
                    assignment.sourceRule
            });
        }
    }


    /*
        NIC NIE PASUJE
    */

    if (matches.length === 0) {

        return {
            status: "not-found"
        };
    }


    /*
        JEDEN REJON
    */

    if (matches.length === 1) {

        return {
            status: "found",
            ...matches[0]
        };
    }


    /*
        KILKA REJONÓW
    */

    return {
        status: "conflict",
        matches: matches
    };
}


/* =========================
   ELEMENTY STRONY
========================= */

const searchForm =
    document.getElementById(
        "searchForm"
    );

const streetInput =
    document.getElementById(
        "street"
    );

const houseNumberInput =
    document.getElementById(
        "houseNumber"
    );

const resultElement =
    document.getElementById(
        "result"
    );

const streetList =
    document.getElementById(
        "streetList"
    );


/* =========================
   LISTA ULIC
========================= */

function loadStreetList() {

    streetList.innerHTML = "";


    const streets = data.streets
        .map(item => item.street)
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "pl"
                )
        );


    for (const street of streets) {

        const option =
            document.createElement(
                "option"
            );


        option.value = street;


        streetList.appendChild(
            option
        );
    }
}


/* =========================
   FORMULARZ
========================= */

function updateSearchResult() {

    if (!data) {
        return;
    }

    const street =
        streetInput.value.trim();

    const houseNumber =
        houseNumberInput.value.trim();


    // Nie pokazujemy błędu,
    // dopóki użytkownik nie poda obu wartości.
    if (!street || !houseNumber) {

        resultElement.className =
            "result hidden";

        resultElement.innerHTML = "";

        return;
    }


    const result =
        findRegion(
            street,
            houseNumber
        );


    displayResult(result);
}


streetInput.addEventListener(
    "input",
    updateSearchResult
);


houseNumberInput.addEventListener(
    "input",
    updateSearchResult
);


/* =========================
   WYŚWIETLANIE WYNIKU
========================= */

function displayResult(result) {

    resultElement.className =
        "result";


    switch (result.status) {


        case "found":

            resultElement
                .classList
                .add("success");


            resultElement.innerHTML = `
                <div>
                    Adres należy do:
                </div>

                <div class="result-region">
                    Rejon ${result.region}
                </div>

                ${
                    result.verified === false
                        ? `
                            <small>
                                ⚠️ Wpis nie został jeszcze
                                zweryfikowany z kartką.
                            </small>
                          `
                        : ""
                }
            `;

            break;


        case "conflict":

            resultElement
                .classList
                .add("warning");


            resultElement.innerHTML = `
                <strong>
                    ⚠️ Niejednoznaczne dane
                </strong>

                <p>
                    Ten adres pasuje do kilku rejonów:
                    ${result.matches
                        .map(
                            item =>
                                item.region
                        )
                        .join(", ")}
                </p>
            `;

            break;


        case "street-not-found":

            resultElement
                .classList
                .add("error");


            resultElement.innerHTML = `
                <strong>
                    Nie znaleziono ulicy.
                </strong>

                <p>
                    Sprawdź poprawność nazwy.
                </p>
            `;

            break;


        case "invalid-number":

            resultElement
                .classList
                .add("error");


            resultElement.innerHTML = `
                <strong>
                    Nieprawidłowy numer budynku.
                </strong>

                <p>
                    Wpisz np. 72, 20a lub 10b.
                </p>
            `;

            break;


        case "data-error":

            resultElement
                .classList
                .add("error");


            resultElement.innerHTML = `
                <strong>
                    Nie udało się wczytać danych.
                </strong>

                <p>
                    Spróbuj odświeżyć stronę.
                </p>
            `;

            break;


        case "not-found":

            resultElement
                .classList
                .add("error");


            resultElement.innerHTML = `
                <strong>
                    Nie znaleziono rejonu.
                </strong>

                <p>
                    Ulica istnieje w bazie,
                    ale podany numer nie pasuje
                    do żadnego rejonu.
                </p>
            `;

            break;
    }
}