import times from 'lodash/times'
import random from 'lodash/random'
import { gameStates, tileLevelStates, tileUserStates, difficulties, directions, getOppositeDirection, keyCodesToDirections, xyEqual, xyInArray } from './base'
import * as snakeHandlers from './snake'


const generateFoodXY = ({ columns, rows }) => ({
  x: random(0, columns - 1),
  y: random(0, rows - 1),
})

const generateValidFoodXY = ({ columns, rows }, isValid) => {
  let foodXY = null
  do {
    foodXY = generateFoodXY({ columns, rows })
  } while (!isValid(foodXY))
  return foodXY
}

const xyValidatorForSnake = ({ tailToHead }) => (foodXY) => !xyInArray(tailToHead, foodXY)

const restart = ({
  difficultyID,
  settings
}) => {
  if (!settings) {
    settings = difficulties[difficultyID]
  }

  if (!settings) {
    throw new Error(`Unknown difficulty '${difficultyID}'`)
  }
  const { columns, rows, bombOdds } = settings

  const tilesCount = columns * rows
  let bombsCount = Math.round(bombOdds * tilesCount)

  const board = times(rows, (rowIndex) => (
    times(columns, (columnIndex) => {
      // const hasBomb = Math.random() <= bombOdds
      // bombsCount += (hasBomb ? 1 : 0)
      const hasBomb = false
      return {
        bombState: hasBomb ? tileLevelStates.bomb : tileLevelStates.blank,
        userState: tileUserStates.covered
      }
    })
  ))

  const snake1 = snakeHandlers.initial({
    length: 5,
    tailXY: { x: 3, y: 10 },
    headDirection: directions.east
  })
  
  const foodXY = generateValidFoodXY({ columns, rows }, xyValidatorForSnake(snake1))

  return {
    gameState: gameStates.fresh,
    gameStateData: {},
    columns,
    rows,
    snake1,
    foodXY,
    board,
    bombsCount,
    uncoveredCount: 0,
    flagsCount: 0,
    movesCount: 0,
    startedAt: null
  }
}

export const initial = (props) => restart(props)

export function *load(next, prev) {
  // Restart when difficulty changes
  if (!!prev && prev.difficultyID !== next.difficultyID) {
    // Read settings for previous and next difficulties
    let prevSettings = difficulties[prev.difficultyID]
    let nextSettings = difficulties[next.difficultyID]

    let columnsForFraction = (f) => prevSettings.columns + Math.round((nextSettings.columns - prevSettings.columns) * f)
    let rowsForFraction = (f) => prevSettings.rows + Math.round((nextSettings.rows - prevSettings.rows) * f)

    const totalFrames = 12
    // Tween between settings
    for (let frame = 0; frame < totalFrames; frame += 1) {
      yield restart({
        settings: {
          ...nextSettings,
          columns: columnsForFraction(frame / totalFrames),
          rows: rowsForFraction(frame / totalFrames),
        }
      })
    }

    yield restart(next)
  }
}

export const beginRestart = () => ({ gameState: gameStates.restarting })
export const completeRestart = restart

export const tick = (props) => ({ gameState, columns, rows, snake1, foodXY }) => {
  if (gameState !== gameStates.fresh && gameState !== gameStates.playing) {
    return
  }

  const snake1Changes = snakeHandlers.move(props, { foodXY, columns, rows, mirror: false })(snake1)
  const newSnake1 = { ...snake1, ...snake1Changes }

  if (newSnake1.hitSelf) {
    return {
      gameState: gameStates.gameOver,
    }
  }

  if (newSnake1.hitWall) {
    return {
      gameState: gameStates.gameOver,
    }
  }


  if (newSnake1.movesSinceFood === 0) {
    foodXY = generateValidFoodXY({ columns, rows }, xyValidatorForSnake(newSnake1))
  }

  return {
    gameState: gameStates.playing,
    snake1: newSnake1,
    foodXY
  }
}

export const changeSnakeDirection = (props, { keyCode }) => ({ snake1 }) => {
  const direction = keyCodesToDirections[keyCode]
  if (!direction) {
    return
  }

  const oppositeDirection = getOppositeDirection(direction)
  if (snake1.headDirection === oppositeDirection) {
    return
  }

  return {
    snake1: { ...snake1, ...snakeHandlers.changeDirection(props, direction) }
  }
}
