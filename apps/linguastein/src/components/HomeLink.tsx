import { Link } from 'react-router';
import { useCourse } from '../app/course';
import { Icon } from './Icon';
import styles from './AppShell.module.css';

/**
 * The way out of a screen that has no tab bar.
 *
 * Sessions and missions hide `AppNav` so the activity fills the screen, and for
 * a while that left them as the only two places in the app with no way home at
 * all: the single Back button walked history, and history is however many taps
 * the learner happened to make. A mission with three sections and a stage
 * change could be six entries deep before anything went wrong.
 *
 * Its own component rather than markup inside `AppShell` for the reason `AppNav`
 * is one: it needs the course, and a hook in the shell would run on every screen
 * including the ones rendered before a course resolves.
 */
export function HomeLink() {
  const { path } = useCourse();

  return (
    <Link to={path()} className={styles.home} aria-label="Home">
      <Icon name="home" size="lg" />
    </Link>
  );
}
