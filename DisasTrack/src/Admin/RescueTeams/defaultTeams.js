/* ------------------------------------------------------------------
   The starting set of rescue teams: 8 teams with 5 people each.
   Used ONCE by the "Set up default teams" button on the Rescue Teams screen,
   which saves these in Firebase. After that, teams and members are managed
   in the app (Rescue Teams screen and Users screen).

   Names, usernames, emails and phone numbers below are PLACEHOLDERS.
   Edit them here before pressing the button, or edit the people later
   on the Users screen. The first person in each list is the team leader.
------------------------------------------------------------------- */

const TEAMS = [
  { code: "fire.alpha", name: "Fire Team Alpha", type: "Firefighters", base: "Malolos City Fire Station",
    people: ["Ramon Villanueva", "Joel Mendoza", "Carlo Reyes", "Dennis Cruz", "Mark Bautista"] },
  { code: "fire.bravo", name: "Fire Team Bravo", type: "Firefighters", base: "Meycauayan City Fire Station",
    people: ["Antonio Navarro", "Paolo Garcia", "Ryan Santos", "Jericho Lim", "Nathan Ramos"] },
  { code: "police.alpha", name: "Police Team Alpha", type: "Police", base: "Malolos City Police Station",
    people: ["Eduardo Dizon", "Marco Aquino", "Lito Castillo", "Jun Mercado", "Rey Pascual"] },
  { code: "police.bravo", name: "Police Team Bravo", type: "Police", base: "Meycauayan City Police Station",
    people: ["Roberto Lopez", "Erwin Salazar", "Gilbert Torres", "Noel Fernandez", "Allan Domingo"] },
  { code: "medical.alpha", name: "Medical Team Alpha", type: "Medical", base: "Malolos City Medical Post",
    people: ["Angela Rivera", "Maricel Tan", "Joanna Soriano", "Kristine Ocampo", "Patricia Flores"] },
  { code: "medical.bravo", name: "Medical Team Bravo", type: "Medical", base: "Meycauayan City Medical Post",
    people: ["Liza Castro", "Rhea Villar", "Camille Aguilar", "Janine Morales", "Bea Gutierrez"] },
  { code: "road.alpha", name: "Road Team Alpha", type: "Road Officers", base: "Malolos City Traffic Office",
    people: ["Felix Hernandez", "Oscar Valdez", "Nilo Cabrera", "Arman Delos Santos", "Teddy Ignacio"] },
  { code: "road.bravo", name: "Road Team Bravo", type: "Road Officers", base: "Meycauayan City Traffic Office",
    people: ["Gerardo Manalo", "Benjie Alvarez", "Rolly Mariano", "Dante Enriquez", "Sonny Padilla"] },
];

export const DEFAULT_TEAMS = TEAMS.map((team, t) => ({
  id: `T-${String(t + 1).padStart(2, "0")}`,
  name: team.name,
  type: team.type,
  base: team.base,
  members: team.people.map((name, i) => ({
    name,
    username: `${team.code}.${i + 1}`, // e.g. fire.alpha.1 (number 1 = the team leader)
    email: `${team.code}.${i + 1}@disastrack.test`, // placeholder email
    phone: `0917 000 ${String((t + 1) * 10 + i + 1).padStart(4, "0")}`, // placeholder number
  })),
}));

export const TOTAL_MEMBERS = DEFAULT_TEAMS.reduce((sum, t) => sum + t.members.length, 0);
