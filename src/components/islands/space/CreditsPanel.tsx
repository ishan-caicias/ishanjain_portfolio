import { shipCredit } from "../../../content/spaceCredits";

export default function CreditsPanel() {
  return (
    <aside aria-labelledby="ship-credit-title">
      <h2 id="ship-credit-title">Ship credits</h2>
      <p>{shipCredit.title}</p>
      <p>By {shipCredit.author}</p>
      <p>{shipCredit.modificationNote}</p>
      <p>
        <a href={shipCredit.sourceUrl} rel="noreferrer" target="_blank">
          View model source
        </a>
        {" · "}
        <a
          href={shipCredit.licenceUrl}
          rel="license noreferrer"
          target="_blank"
        >
          CC BY 4.0 licence
        </a>
      </p>
    </aside>
  );
}
