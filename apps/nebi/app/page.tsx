const features = [
  {
    title: "Works where you work",
    body: "The toolbar sits beside your UI, so you can ask for changes without switching to another tool.",
  },
];

export default function Home() {
  return (
    <main>
      <div className="eyebrow">Nebi for Next.js</div>
      <h1>Change this app from inside the app.</h1>
      <p>
        Ask the coding agent to update this page. Nebi will change it immediately so you
        can try the result, then let you keep or discard the update.
      </p>
      <div className="hint">Try “Add a three-card features section below this paragraph.”</div>

      <section className="features" aria-labelledby="features-heading">
        <h2 className="sr-only" id="features-heading">
          Features
        </h2>
        <ul className="feature-grid">
          {features.map((feature) => (
            <li className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
