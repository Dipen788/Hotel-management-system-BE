import { styles } from "../../styles/theme";

export default function StatusBadge({ label }) {
  return (
    <span style={styles.badge(label)}>
      <span style={styles.dot(label)} />
      {label}
    </span>
  );
}
