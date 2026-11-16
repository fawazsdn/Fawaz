import { stagingExploreEnabled } from '@/backend/exploreFeed';

import ExploreDirectory from '@/features/explore/ExploreDirectory';
import { ExploreSocialFeed } from '@/features/explore/ExploreSocialFeed';

export default function DiscoverScreen() {
  return stagingExploreEnabled ? <ExploreSocialFeed /> : <ExploreDirectory />;
}
