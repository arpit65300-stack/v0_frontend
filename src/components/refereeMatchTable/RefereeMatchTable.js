import React, { useEffect, useState } from 'react';
import { apiCall } from '@/store/utils';
import { endpoints } from '@/store/urls';
import stl from './RefereeMatchTable.module.scss';
import toast from 'react-hot-toast';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField } from '@mui/material';

const RefereeMatchTable = ({ tournamentId }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMatch, setEditingMatch] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [scores, setScores] = useState({ team1Score: 0, team2Score: 0 });
  const [modalType, setModalType] = useState('start'); // 'start' or 'completed'

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const response = await apiCall(endpoints.getFixtures, {
          params: { tournament_id: tournamentId }
        });
        if (response && response.matches) {
          setMatches(response.matches);
        }
      } catch (error) {
        console.error('Failed to fetch matches:', error);
        toast.error('Failed to load matches');
      } finally {
        setLoading(false);
      }
    };

    if (tournamentId) {
      fetchMatches();
    }
  }, [tournamentId]);

  const handleStartMatch = async (match) => {
    try {
      await apiCall(`${endpoints.updateMatchStatus}/${match.match_id}`, {
        method: "POST",
        body: { tournament_id: tournamentId, status: "on-going" }
      });
      // Update local state
      setMatches(matches.map(m => 
        m.match_id === match.match_id ? { ...m, match_status: { ...m.match_status, status: 'on-going' }} : m
      ));
      toast.success("Match started successfully");
    } catch (error) {
      console.error("Failed to start match:", error);
      toast.error(error.message || "Failed to start match");
    }
  };

  const handleWalkover = async (match, winnerTeamId) => {
    try {
      const response = await fetch('/walkover', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: match.match_id,
          winner_team_id: winnerTeamId
        })
      });

      const resp = await response.json();
      if (!response.ok) {
        throw new Error(resp.error || 'Failed to declare walkover');
      }

      // Update local state to mark match completed and set winner
      setMatches(matches.map(m => {
        if (m.match_id === match.match_id) {
          return {
            ...m,
            match_result: 'W/O',
            match_status: { ...m.match_status, status: 'completed', is_final: true, winner_team_id: winnerTeamId }
          };
        }
        return m;
      }));

      toast.success('Walkover declared successfully');
    } catch (error) {
      console.error('Failed to declare walkover:', error);
      toast.error(error.message || 'Failed to declare walkover');
    }
  };

  const handleScoreUpdate = async (match, isFinal = false, override = false) => {
    try {
      const requestBody = {
        tournament_id: tournamentId,
        match_id: match.match_id,
        score: `${scores.team1Score}-${scores.team2Score}`,
        final: isFinal,
        override: override
      };

      const scorePromise = fetch(endpoints.updateMatchScore, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const statusPromise = isFinal 
        ? apiCall(`${endpoints.updateMatchStatus}/${match.match_id}`, {
            method: "POST",
            body: { tournament_id: tournamentId, status: "completed" }
          })
        : Promise.resolve();

      const [response] = await Promise.all([scorePromise, statusPromise]);
      const resp = await response.json();

      if (!response.ok) {
        if (response.status === 400 && resp.error?.includes("already been finalized")) {
          const shouldOverride = window.confirm("Match is already finalized. Would you like to override?");
          if (shouldOverride) {
            return handleScoreUpdate(match, isFinal, true);
          }
        }
        throw new Error(resp.error || 'Failed to update score');
      }

      // Update local state
      setMatches(matches.map(m => {
        if (m.match_id === match.match_id) {
          return {
            ...m,
            match_result: `${scores.team1Score}-${scores.team2Score}`,
            match_status: isFinal ? { ...m.match_status, status: 'completed', is_final: true } : m.match_status
          };
        }
        return m;
      }));

      setEditingMatch(null);
      toast.success(isFinal ? 'Match finalized successfully' : 'Score updated successfully');
    } catch (error) {
      console.error('Failed to update score:', error);
      toast.error(error.message || 'Failed to update score');
    }
  };

  const handleEditClick = (match) => {
    if (match.match_status.status === 'completed') {
      setSelectedMatch(match);
      setModalType('completed');
      setShowStatusModal(true);
      return;
    }
    const [team1Score, team2Score] = match.match_result ? match.match_result.split('-').map(Number) : [0, 0];
    setScores({ team1Score: team1Score || 0, team2Score: team2Score || 0 });
    setEditingMatch(match);
  };

  const handleStartMatchClick = (match) => {
    setSelectedMatch(match);
    setModalType('start');
    setShowStatusModal(true);
  };

  if (loading) {
    return <div className={stl.loading}>Loading matches...</div>;
  }

  return (
    <div className={stl.container}>
      <div className={stl.tableWrapper}>
        <table className={stl.table}>
          <thead>
            <tr>
              <th>Match ID</th>
              <th>Round</th>
              <th>Pool</th>
              <th>Team 1</th>
              <th>Team 2</th>
              <th>Result</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.match_id}>
                <td>{match.match_id}</td>
                <td>{match.round_name || `Round ${match.round_id}`}</td>
                <td>{match.pool || '-'}</td>
                <td>{match.team1_players}</td>
                <td>{match.team2_players}</td>
                <td>
                  {editingMatch?.match_id === match.match_id ? (
                    <div className={stl.scoreInputs}>
                      <TextField
                        size="small"
                        type="number"
                        value={scores.team1Score}
                        onChange={(e) => setScores({ ...scores, team1Score: Math.max(0, parseInt(e.target.value) || 0) })}
                      />
                      <span>-</span>
                      <TextField
                        size="small"
                        type="number"
                        value={scores.team2Score}
                        onChange={(e) => setScores({ ...scores, team2Score: Math.max(0, parseInt(e.target.value) || 0) })}
                      />
                    </div>
                  ) : (
                    match.match_result === 'W/O' || match.match_status?.is_walkover ? (
                      <span className="font-bold text-orange-600">W/O</span>
                    ) : (
                      match.match_result
                    )
                  )}
                </td>
                <td>
                  <span className={`${stl.status} ${stl[match.match_status.status]}`}>
                    {match.match_status.status}
                  </span>
                </td>
                <td>
                  {match.match_status.status === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <button onClick={() => handleStartMatchClick(match)} className={stl.startButton}>
                        Start Match
                      </button>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleWalkover(match, match.team1_id)} style={{ backgroundColor: '#ff9800', color: '#fff', fontSize: '10px', padding: '4px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                          W/O (Team 1)
                        </button>
                        <button onClick={() => handleWalkover(match, match.team2_id)} style={{ backgroundColor: '#ff9800', color: '#fff', fontSize: '10px', padding: '4px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                          W/O (Team 2)
                        </button>
                      </div>
                    </div>
                  )}
                  {match.match_status.status === 'on-going' && (
                    editingMatch?.match_id === match.match_id ? (
                      <div className={stl.actionButtons}>
                        <button onClick={() => handleScoreUpdate(match)} className={stl.updateButton}>
                          Update
                        </button>
                        <button onClick={() => handleScoreUpdate(match, true)} className={stl.finalizeButton}>
                          Finalize
                        </button>
                        <button onClick={() => setEditingMatch(null)} className={stl.cancelButton}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <button onClick={() => handleEditClick(match)} className={stl.editButton}>
                          Edit Score
                        </button>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleWalkover(match, match.team1_id)} style={{ backgroundColor: '#ff9800', color: '#fff', fontSize: '10px', padding: '4px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                            W/O (Team 1)
                          </button>
                          <button onClick={() => handleWalkover(match, match.team2_id)} style={{ backgroundColor: '#ff9800', color: '#fff', fontSize: '10px', padding: '4px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                            W/O (Team 2)
                          </button>
                        </div>
                      </div>
                    )
                  )}
                  {match.match_status.status === 'completed' && (
                    <button onClick={() => handleEditClick(match)} className={stl.editButton}>
                      Override Score
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showStatusModal} onClose={() => setShowStatusModal(false)}>
        <DialogTitle>
          {modalType === 'start' ? 'Start Match' : 'Match Completed'}
        </DialogTitle>
        <DialogContent>
          {modalType === 'start' ? (
            <p>Are you sure you want to start this match?</p>
          ) : (
            <p>This match has been completed. Would you like to override the scores?</p>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStatusModal(false)} style={{ color: '#F28C28' }}>
            Cancel
          </Button>
          {modalType === 'start' ? (
            <Button onClick={() => { handleStartMatch(selectedMatch); setShowStatusModal(false); }} style={{ color: '#4CAF50' }}>
              Start Match
            </Button>
          ) : (
            <Button onClick={() => { 
              const [team1Score, team2Score] = selectedMatch.match_result ? selectedMatch.match_result.split('-').map(Number) : [0, 0];
              setScores({ team1Score: team1Score || 0, team2Score: team2Score || 0 });
              setEditingMatch(selectedMatch);
              setShowStatusModal(false);
            }} style={{ color: '#4CAF50' }}>
              Override Score
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RefereeMatchTable;
