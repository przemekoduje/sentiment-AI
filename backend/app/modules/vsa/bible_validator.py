import os

class BibleGuard:
    """
    Phase 16: Institutional VSA Bible Validator.
    Cross-references calculated metrics against the canonical rules defined in 'vsa_bible.md'.
    """
    BIBLE_PATH = "/Users/przemyslawrakotny/Documents/przemokoduje/sentiment-ai/backend/app/knowledge/vsa_bible.md"

    @staticmethod
    def get_bible_content():
        if os.path.exists(BibleGuard.BIBLE_PATH):
            with open(BibleGuard.BIBLE_PATH, "r") as f:
                return f.read()
        return "BIBLE NOT FOUND"

    @staticmethod
    def validate_logic(action, tags, metrics):
        """
        Hard-coded validation based on Bible rules (vsa_bible.md).
        Returns (is_valid, error_msg)
        """
        spread_v = metrics.get('spread_relative', 'AVERAGE')
        vol_v = metrics.get('volume_relative', 'AVERAGE')
        close_v = metrics.get('close_position', 0.5)

        # Ensure we have tags to check
        if not tags:
            return True, ""

        # 1. Rule 'No Demand' (Bible Lines 106-111)
        if "NO_DEMAND" in tags:
            if spread_v != "NARROW":
                return False, f"BIBLE_VIOLATION: No Demand requires NARROW spread (got {spread_v})."
            if close_v > 0.66:
                return False, f"BIBLE_VIOLATION: No Demand requires close in lower/middle tercile (got {round(close_v, 2)})."

        # 2. Rule 'Upthrust' (Bible Lines 104-105)
        if "UPTHRUST" in tags:
            if close_v > 0.4:
                 return False, f"BIBLE_VIOLATION: Upthrust requires closing in the bottom tercile (got {round(close_v, 2)})."

        # 3. Rule 'No Supply' (Bible Lines 122-123)
        if "NO_SUPPLY" in tags:
            if spread_v != "NARROW":
                return False, f"BIBLE_VIOLATION: No Supply requires NARROW spread (got {spread_v})."
            if vol_v not in ["LOW", "VERY_LOW"]:
                return False, f"BIBLE_VIOLATION: No Supply requires LOW volume (got {vol_v})."

        # 4. Rule 'Buying Climax' (Bible Lines 102-103)
        if "BUYING_CLIMAX" in tags:
            if spread_v != "WIDE":
                return False, f"BIBLE_VIOLATION: Buying Climax requires WIDE spread (got {spread_v})."
            if close_v > 0.66:
                return False, f"BIBLE_VIOLATION: Buying Climax requires close in middle/lower tercile (got {round(close_v, 2)})."

        # 5. Rule 'Selling Climax' (Bible Lines 116-117)
        if "SELLING_CLIMAX" in tags:
            if spread_v != "WIDE":
                return False, f"BIBLE_VIOLATION: Selling Climax requires WIDE spread (got {spread_v})."
            if close_v < 0.33:
                return False, f"BIBLE_VIOLATION: Selling Climax requires close in middle/upper tercile (got {round(close_v, 2)})."

        # 6. Rule 'Bag Holding' (Bible Lines 120-121)
        if "BAG_HOLDING" in tags:
            if spread_v != "NARROW":
                return False, f"BIBLE_VIOLATION: Bag Holding requires NARROW spread (got {spread_v})."
            if vol_v not in ["HIGH", "ULTRA_HIGH"]:
                return False, f"BIBLE_VIOLATION: Bag Holding requires HIGH volume (got {vol_v})."

        return True, ""
