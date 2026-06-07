export interface VSATerm {
  term: string;
  definition: string;
  category: "SOS" | "SOW" | "PHASE" | "GENERAL";
}

export const VSA_DICTIONARY: VSATerm[] = [
  {
    term: "SOW",
    definition: "Sign of Weakness – Oznaka Słabości. Sygnał wskazujący na przewagę podaży, często po wzroście lub w fazie dystrybucji.",
    category: "SOW"
  },
  {
    term: "SOS",
    definition: "Sign of Strength – Oznaka Siły. Sygnał wskazujący na przewagę popytu, często po spadku lub w fazie akumulacji.",
    category: "SOS"
  },
  {
    term: "No Demand",
    definition: "Brak Popytu – Świeca o wąskim spreadzie i niskim wolumenie, co sugeruje brak zainteresowania kupujących dalszym wzrostem.",
    category: "SOW"
  },
  {
    term: "No Supply",
    definition: "Brak Podaży – Świeca o wąskim spreadzie i niskim wolumenie przy teście dołka, co sugeruje wyczerpanie podaży.",
    category: "SOS"
  },
  {
    term: "Upthrust",
    definition: "Pułapka na Byki – Nagłe wybicie szczytu, które szybko zawraca i zamyka się nisko, zazwyczaj na wysokim wolumenie.",
    category: "SOW"
  },
  {
    term: "Spring",
    definition: "Pułapka na Niedźwiedzie – Chwilowe przebicie dołka, po którym cena gwałtownie wraca powyżej wsparcia.",
    category: "SOS"
  },
  {
    term: "Shakeout",
    definition: "Wyczyszczenie Rynku – Gwałtowny spadek mający na celu wyrzucenie słabych rąk z rynku przed właściwym wzrostem.",
    category: "GENERAL"
  },
  {
    term: "Buying Climax",
    definition: "Kulminacja Kupna – Ekstremalny wzrost wolumenu na szczycie, oznaczający, że Smart Money wyprzedaje akcje spóźnionym inwestorom.",
    category: "SOW"
  },
  {
    term: "Selling Climax",
    definition: "Kulminacja Sprzedaży – Paniczna wyprzedaż na ogromnym wolumenie, gdzie Smart Money zaczyna odkupować akcje.",
    category: "SOS"
  },
  {
    term: "Accumulation",
    definition: "Akumulacja – Faza, w której instytucje (Smart Money) cierpliwie skupują aktywa po niskich cenach.",
    category: "PHASE"
  },
  {
    term: "Distribution",
    definition: "Dystrybucja – Faza, w której instytucje wyprzedają wcześniej kupione aktywa po wysokich cenach.",
    category: "PHASE"
  },
  {
    term: "Markup",
    definition: "Faza Wzrostu – Trend wzrostowy następujący po zakończeniu akumulacji.",
    category: "PHASE"
  },
  {
    term: "Markdown",
    definition: "Faza Spadku – Trend spadkowy następujący po zakończeniu dystrybucji.",
    category: "PHASE"
  },
  {
    term: "Smart Money",
    definition: "Profesjonalni Inwestorzy – Duże instytucje i gracze o ogromnym kapitale, którzy realnie wpływają na ruchy cen.",
    category: "GENERAL"
  },
  {
    term: "Bag Holding",
    definition: "Brak Akceptacji Spadku – Świeca o wąskim spreadzie na bardzo wysokim wolumenie po spadku, co sugeruje przejmowanie podaży przez Smart Money.",
    category: "SOS"
  }
];
