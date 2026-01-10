import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.greeting}>Hello Noah!</Text>
        <Text style={styles.subtle}>Your available balance</Text>
        <Text style={styles.balance}>$15,0</Text>

        <View style={styles.actionRow}>
          {[{ label: "Top Up" }, { label: "Swap" }, { label: "Request" }].map(
            (b) => (
              <TouchableOpacity key={b.label} style={styles.actionButton}>
                <Text style={styles.actionLabel}>{b.label}</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        <Text style={styles.sectionTitle}>Payment List</Text>
        <View style={styles.paymentRow}>
          {["Internet", "Electricity", "Education", "View All"].map((i) => (
            <View key={i} style={styles.paymentCard}>
              <Text style={styles.paymentLabel}>{i}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Promo and Discount</Text>
        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>Get Discounts Up To 10%</Text>
          <Text style={styles.promoSubtitle}>on education payments</Text>
          <TouchableOpacity style={styles.promoButton}>
            <Text style={styles.promoButtonLabel}>Click Here</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Transaction</Text>
        {[1, 2].map((t) => (
          <View key={t} style={styles.transactionCard}>
            <Text style={styles.transactionMerchant}>Fauget Store</Text>
            <Text style={styles.transactionDate}>May 4th, 2025</Text>
            <View style={styles.transactionFooter}>
              <Text style={styles.transactionMeta}>Payment</Text>
              <Text style={styles.transactionMeta}>Success</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C0F16",
  },
  scroll: {
    flex: 1,
    paddingTop: 96,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 64,
  },
  greeting: {
    color: "#FFFFFF",
    fontSize: 20,
    marginBottom: 4,
  },
  subtle: {
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  balance: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  actionLabel: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 12,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  paymentCard: {
    width: "22%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  paymentLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    textAlign: "center",
  },
  promoCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  promoTitle: {
    color: "#FFFFFF",
    marginBottom: 4,
  },
  promoSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  promoButton: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  promoButtonLabel: {
    color: "#FFFFFF",
  },
  transactionCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  transactionMerchant: {
    color: "#FFFFFF",
  },
  transactionDate: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
  },
  transactionFooter: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  transactionMeta: {
    color: "rgba(255,255,255,0.8)",
  },
});
