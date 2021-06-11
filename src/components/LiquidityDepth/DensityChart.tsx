import React, { useEffect, useState } from 'react'
import { VictoryBar, VictoryLine, VictoryBrushContainer, VictoryAxis, VictoryChart, VictoryLabel } from 'victory'
import useTheme from 'hooks/useTheme'
import { Currency, Price, Token } from '@uniswap/sdk-core'
import { FeeAmount } from '@uniswap/v3-sdk'
import { useColor } from 'hooks/useColor'
import { Brush } from './Brush'
import JSBI from 'jsbi'
import { usePoolTickData, PRICE_FIXED_DIGITS } from 'hooks/usePoolTickData'
import { TickProcessed } from 'constants/ticks'
import Loader from 'components/Loader'
import styled from 'styled-components'
import { Box } from 'rebass'
import { Trans } from '@lingui/macro'
import { XCircle } from 'react-feather'
import { TYPE } from '../../theme'
import { ColumnCenter } from 'components/Column'

interface ChartEntry {
  index: number
  isCurrent: boolean
  activeLiquidity: number
  price0: number
  price1: number
}

const sampleData: Partial<ChartEntry>[] = [
  { price0: 0, activeLiquidity: 1 },
  { price0: 1, activeLiquidity: 2 },
  { price0: 2, activeLiquidity: 3 },
  { price0: 3, activeLiquidity: 6 },
  { price0: 4, activeLiquidity: 5 },
  { price0: 5, activeLiquidity: 3 },
  { price0: 6, activeLiquidity: 2 },
]

const Wrapper = styled(Box)`
  position: relative;
  height: 250px;

  display: grid;
  justify-content: center;
  align-content: center;
`

const SyncingIndicator = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
`

function useDensityChartData({
  currencyA,
  currencyB,
  feeAmount,
}: {
  currencyA: Currency | undefined
  currencyB: Currency | undefined
  feeAmount: FeeAmount | undefined
}) {
  const [formattedData, setFormattedData] = useState<ChartEntry[] | undefined>()
  const [priceAtActiveTick, setPriceAtActiveTick] = useState<number | undefined>()
  const [maxLiquidity, setMaxLiquidity] = useState<number>(0)

  const { loading, syncing, error, activeTick, tickData } = usePoolTickData(currencyA, currencyB, feeAmount)

  // clear data when inputs are cleared
  useEffect(() => {
    if ((!currencyA || !currencyB || !feeAmount) && Boolean(formattedData?.length)) {
      setFormattedData([])
    }
  }, [currencyA, currencyB, feeAmount, formattedData])

  useEffect(() => {
    function formatData() {
      if (!tickData?.length) {
        return
      }

      const newData: ChartEntry[] = []
      let maxLiquidity = JSBI.BigInt(0)

      for (let i = 0; i < tickData.length; i++) {
        const t: TickProcessed = tickData[i]
        const active = t.tickIdx === activeTick

        maxLiquidity = JSBI.greaterThan(tickData[i].liquidityActive, maxLiquidity)
          ? tickData[i].liquidityActive
          : maxLiquidity

        const chartEntry = {
          index: i,
          isCurrent: active,
          activeLiquidity: parseFloat(t.liquidityActive.toString()),
          price0: parseFloat(t.price0),
          price1: parseFloat(t.price1),
        }

        if (active) {
          setPriceAtActiveTick(chartEntry.price0)
        }

        newData.push(chartEntry)
      }

      setMaxLiquidity(parseFloat(maxLiquidity.toString()))

      if (newData) {
        setFormattedData(newData)
      }
    }

    if (!loading) {
      formatData()
    }
  }, [loading, activeTick, tickData])

  return {
    loading,
    syncing,
    error,
    priceAtActiveTick,
    maxLiquidity,
    formattedData,
  }
}

export default function DensityChart({
  price,
  currencyA,
  currencyB,
  feeAmount,
  priceLower,
  priceUpper,
  onLeftRangeInput,
  onRightRangeInput,
}: {
  price: string | undefined
  currencyA: Currency | undefined
  currencyB: Currency | undefined
  feeAmount?: number
  priceLower?: Price<Token, Token>
  priceUpper?: Price<Token, Token>
  onLeftRangeInput: (typedValue: string) => void
  onRightRangeInput: (typedValue: string) => void
}) {
  const theme = useTheme()

  const tokenAColor = useColor(currencyA?.wrapped)
  const tokenBColor = useColor(currencyB?.wrapped)

  const { loading, syncing, priceAtActiveTick, maxLiquidity, formattedData } = useDensityChartData({
    currencyA,
    currencyB,
    feeAmount,
  })

  const isSorted = currencyA && currencyB && currencyA?.wrapped.sortsBefore(currencyB?.wrapped)

  const leftPrice = isSorted ? priceLower : priceUpper?.invert()
  const rightPrice = isSorted ? priceUpper : priceLower?.invert()

  if (loading) {
    return (
      <Wrapper>
        <Loader stroke={theme.text4} />
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      {syncing ? (
        <SyncingIndicator>
          <Loader stroke={theme.text4} />
        </SyncingIndicator>
      ) : null}

      {formattedData && formattedData?.length === 0 ? (
        <ColumnCenter>
          <XCircle stroke={theme.text4} />
          <TYPE.darkGray padding={10}>
            <Trans>No data</Trans>
          </TYPE.darkGray>
        </ColumnCenter>
      ) : (
        <VictoryChart
          animate={{ duration: 500, easing: 'cubic' }}
          height={275}
          padding={40}
          containerComponent={
            <VictoryBrushContainer
              allowDraw={false}
              allowDrag={Boolean(formattedData?.length)}
              allowResize={Boolean(formattedData?.length)}
              brushDimension="x"
              handleWidth={40}
              brushDomain={
                leftPrice && rightPrice
                  ? {
                      x: [parseFloat(leftPrice?.toSignificant(5)), parseFloat(rightPrice?.toSignificant(5))],
                    }
                  : undefined
              }
              brushComponent={
                <Brush
                  leftHandleColor={currencyA ? tokenAColor : theme.primary1}
                  rightHandleColor={currencyB ? tokenBColor : theme.secondary1}
                  allowDrag={Boolean(formattedData?.length)}
                />
              }
              onBrushDomainChangeEnd={(domain) => {
                const leftRangeValue = Number(domain.x[0])
                const rightRangeValue = Number(domain.x[1])

                leftRangeValue > 0 && onLeftRangeInput(leftRangeValue.toFixed(PRICE_FIXED_DIGITS))
                rightRangeValue > 0 && onRightRangeInput(rightRangeValue.toFixed(PRICE_FIXED_DIGITS))
              }}
            />
          }
        >
          <VictoryBar
            data={formattedData ? formattedData : sampleData}
            style={{ data: { stroke: theme.blue1, fill: theme.blue1, opacity: '0.2' } }}
            x={'price0'}
            y={'activeLiquidity'}
          />

          {/* Plot at `priceAtActiveTick` to put on same axis as VictoryBar, but display `price` as label */}
          {price && (
            <VictoryLine
              data={
                maxLiquidity && priceAtActiveTick
                  ? [
                      { x: priceAtActiveTick, y: 0 },
                      { x: priceAtActiveTick, y: maxLiquidity },
                    ]
                  : []
              }
              labels={({ datum }) => (datum.y !== 0 ? price : '')}
              labelComponent={
                <VictoryLabel
                  renderInPortal
                  dy={-20}
                  style={{ fill: theme.primaryText1, fontWeight: 500, fontSize: 15 }}
                />
              }
              style={{
                data: { stroke: theme.secondary1 },
              }}
            />
          )}

          <VictoryAxis
            fixLabelOverlap={true}
            style={{
              tickLabels: {
                fill: theme.text1,
                opacity: '0.6',
              },
            }}
          />
        </VictoryChart>
      )}
    </Wrapper>
  )
}