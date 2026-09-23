const features = [
  {
    title: "Works where you work",
  },
];

export default function Home() {
  return (
    <main>
      <div className="eyebrow">Shan for Next.js</div>
      <h1>hello world</h1>
      <p>
        Ask the visual agent to update this page. Shan will change it immediately so you
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
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
