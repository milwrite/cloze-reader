"""
Hugging Face Leaderboard Service
Manages leaderboard data persistence using HF Hub
"""

import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from huggingface_hub import HfApi, hf_hub_download, HfFolder
import logging

logger = logging.getLogger(__name__)


class HFLeaderboardService:
    """
    Service for managing leaderboard data on Hugging Face Hub
    Stores leaderboard as a JSON file in a HF dataset
    """

    def __init__(self, repo_id: str = "zmuhls/cloze-reader-leaderboard", token: Optional[str] = None):
        """
        Initialize HF Leaderboard Service

        Args:
            repo_id: HF Hub repository ID (format: username/repo-name)
            token: HF API token (if not provided, uses HF_TOKEN env var)
        """
        self.repo_id = repo_id
        self.token = token or os.getenv("HF_TOKEN") or os.getenv("HF_API_KEY")
        self.api = HfApi()
        self.leaderboard_file = "leaderboard.json"

        if not self.token:
            logger.warning("No HF token provided. Read-only mode (if repo is public)")

        # Ensure repo exists
        self._ensure_repo_exists()

    def _ensure_repo_exists(self):
        """Create the HF dataset repository if it doesn't exist"""
        if not self.token:
            return

        try:
            # Try to get repo info
            self.api.repo_info(repo_id=self.repo_id, repo_type="dataset", token=self.token)
            logger.info(f"Using existing HF dataset: {self.repo_id}")
        except Exception as e:
            # Repo doesn't exist, create it
            try:
                self.api.create_repo(
                    repo_id=self.repo_id,
                    repo_type="dataset",
                    token=self.token,
                    private=False,
                    exist_ok=True
                )
                logger.info(f"Created HF dataset: {self.repo_id}")

                # Initialize with empty leaderboard
                self._save_to_hub([])
            except Exception as create_error:
                logger.error(f"Failed to create HF repo: {create_error}")

    def _save_to_hub(self, data: List[Dict]):
        """
        Save leaderboard data to HF Hub

        Args:
            data: List of leaderboard entries
        """
        if not self.token:
            raise ValueError("No HF token available for writing")

        # Create temporary file
        temp_file = f"/tmp/{self.leaderboard_file}"
        with open(temp_file, "w") as f:
            json.dump({
                "leaderboard": data,
                "last_updated": datetime.utcnow().isoformat(),
                "version": "1.0"
            }, f, indent=2)

        # Upload to HF Hub
        try:
            self.api.upload_file(
                path_or_fileobj=temp_file,
                path_in_repo=self.leaderboard_file,
                repo_id=self.repo_id,
                repo_type="dataset",
                token=self.token,
                commit_message=f"Update leaderboard - {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"
            )
            logger.info(f"Leaderboard saved to HF Hub: {self.repo_id}")
        except Exception as e:
            logger.error(f"Failed to upload to HF Hub: {e}")
            raise
        finally:
            # Clean up temp file
            if os.path.exists(temp_file):
                os.remove(temp_file)

    def _load_from_hub(self) -> List[Dict]:
        """
        Load leaderboard data from HF Hub

        Returns:
            List of leaderboard entries
        """
        try:
            # Download file from HF Hub
            file_path = hf_hub_download(
                repo_id=self.repo_id,
                filename=self.leaderboard_file,
                repo_type="dataset",
                token=self.token
            )

            with open(file_path, "r") as f:
                data = json.load(f)
                return data.get("leaderboard", [])
        except Exception as e:
            logger.warning(f"Failed to load from HF Hub: {e}. Returning empty leaderboard.")
            return []

    def get_leaderboard(self) -> List[Dict]:
        """
        Get current leaderboard data

        Returns:
            List of leaderboard entries sorted by rank
        """
        return self._load_from_hub()

    def add_entry(self, entry: Dict) -> bool:
        """
        Add new entry to leaderboard

        Args:
            entry: Leaderboard entry with keys: initials, level, round, passagesPassed, date

        Returns:
            True if successful, False otherwise
        """
        if not self.token:
            raise ValueError("No HF token available for writing")

        try:
            # Load current leaderboard
            leaderboard = self._load_from_hub()

            # Add new entry
            leaderboard.append(entry)

            # Sort leaderboard (highest level first, then round, then passages)
            leaderboard = self._sort_leaderboard(leaderboard)

            # Keep only top 10
            leaderboard = leaderboard[:10]

            # Save back to hub
            self._save_to_hub(leaderboard)

            logger.info(f"Added entry to leaderboard: {entry['initials']} - Level {entry['level']}")
            return True
        except Exception as e:
            logger.error(f"Failed to add entry: {e}")
            return False

    def update_leaderboard(self, leaderboard: List[Dict]) -> bool:
        """
        Replace entire leaderboard with new data

        Args:
            leaderboard: Complete leaderboard data

        Returns:
            True if successful, False otherwise
        """
        if not self.token:
            raise ValueError("No HF token available for writing")

        try:
            # Sort and limit to top 10
            sorted_board = self._sort_leaderboard(leaderboard)[:10]
            self._save_to_hub(sorted_board)
            return True
        except Exception as e:
            logger.error(f"Failed to update leaderboard: {e}")
            return False

    def _sort_leaderboard(self, entries: List[Dict]) -> List[Dict]:
        """
        Sort leaderboard entries by performance

        Args:
            entries: List of leaderboard entries

        Returns:
            Sorted list (best first)
        """
        return sorted(entries, key=lambda x: (
            -x.get('level', 0),  # Higher level is better
            -x.get('round', 0),  # Higher round is better
            -x.get('passagesPassed', 0),  # More passages is better
            x.get('date', '')  # Newer is better (date sorts ascending)
        ))

    def clear_leaderboard(self) -> bool:
        """
        Clear all leaderboard data (admin function)

        Returns:
            True if successful, False otherwise
        """
        if not self.token:
            raise ValueError("No HF token available for writing")

        try:
            self._save_to_hub([])
            logger.info("Leaderboard cleared")
            return True
        except Exception as e:
            logger.error(f"Failed to clear leaderboard: {e}")
            return False
